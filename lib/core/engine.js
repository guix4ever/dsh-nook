/**
 * The Nook engine: one companion's life, independent of dsh.
 *
 * The host plugin feeds it chat messages and calls `tick()` on a timer; it
 * answers with prompt text and asks the host to deliver messages it decides to
 * send. Model calls, web search and delivery come in as injected functions, so
 * the whole loop runs in tests with fakes.
 */
import { FileStore, newId } from './store.js'
import { initialState } from './state.js'
import { HOUR, DAY, dayKey, describeNow, nextAt, defaultTimeZone } from './clock.js'
import { seedPersona, speechPlan, learnStrategy, notePhrase, settlePhrases, applyGrowth, undoGrowth, mbtiOf } from './persona.js'
import { applyMemoryOps, sealTopic, forget, consolidate as consolidateMemories, knowMap, retrieve } from './memory.js'
import { applyThreadOps, consolidate as consolidateThreads } from './threads.js'
import { appraise, bondNow, settleStage, creditDay, moodNow, recentChanges, STAGES } from './affect.js'
import { candidates, gate, plan, settle, stillValid, withdrawFor, userReplied, asleep, missAfterHours } from './outreach.js'
import { chooseTopic, recordFailure, recordReading, nextExploreAt, coolInterests } from './explore.js'
import { personaSection, stateSnapshot } from './context.js'
import { digestPrompt, notePrompt, decidePrompt, dayCardPrompt, growthPrompt, parseJson } from './prompts.js'
import { clip } from './text.js'

export class NookEngine {
  /**
   * @param deps.dir - storage directory.
   * @param deps.llm - async ({ system, user, purpose }) => string
   * @param deps.search - async (query) => { content?, sources: [{ url, title?, snippet? }] }; throws on failure
   * @param deps.fetch - optional async (url) => readable page text
   * @param deps.deliver - async ({ taskId, text }) => { sessionId, messageId } | undefined (no session to deliver to)
   * @param deps.wasDelivered - async (taskId) => boolean, checks session logs after a crash
   * @param deps.now, deps.random, deps.logger
   */
  constructor(deps) {
    this.deps = deps
    this.store = deps.store ?? new FileStore(deps.dir, initialState)
    this.now = deps.now ?? (() => Date.now())
    this.random = deps.random ?? Math.random
    this.logger = deps.logger ?? { info() {}, warn() {} }
    /** Per-session speaking plans, so the next digest knows which strategy was used. */
    this.plans = new Map()
    this.pendingDigest = new Map()
    this.busy = false
  }

  get state() {
    return this.store.read()
  }

  timeZone() {
    return this.state.settings.timeZone || defaultTimeZone()
  }

  /* ------------------------------------------------------------- setup */

  /** Create the companion ("创建你的伙伴"). */
  setup({ name, relation, mbti }) {
    return this.store.transact((state, log) => {
      const now = this.now()
      state.companion = {
        name: clip(name, 12) || '大D老师',
        relation: relation === 'lover' ? 'lover' : 'friend',
        createdAt: now,
        chosenMbti: /^[EI][NS][FT][JP]$/.test(String(mbti ?? '').toUpperCase()) ? String(mbti).toUpperCase() : undefined,
      }
      if (state.persona === undefined) state.persona = seedPersona(state.companion.chosenMbti, this.random)
      state.schedule.explore = now + 2 * HOUR
      state.schedule.consolidate = nextAt(now, this.timeZone(), state.settings.sleep.start) ?? now + DAY
      state.schedule.growth = now + 7 * DAY
      log('companion.setup', { name: state.companion.name, relation: state.companion.relation, mbti: state.companion.chosenMbti })
      return state.companion
    })
  }

  setAvatar(file) {
    return this.store.transact((state, log) => {
      if (state.companion === undefined) throw new Error('还没有创建伙伴')
      state.companion.avatar = { file, at: this.now() }
      log('companion.avatar', { file })
      return state.companion.avatar
    })
  }

  updateSettings(patch) {
    return this.store.transact((state, log) => {
      const s = state.settings
      if (typeof patch.enabled === 'boolean') s.enabled = patch.enabled
      if (['low', 'medium', 'high'].includes(patch.outreach)) s.outreach = patch.outreach
      if (patch.sleep?.start && patch.sleep?.end) s.sleep = { start: patch.sleep.start, end: patch.sleep.end }
      if (typeof patch.respectWork === 'boolean') s.respectWork = patch.respectWork
      if (typeof patch.explore === 'boolean') s.explore = patch.explore
      if (typeof patch.timeZone === 'string') s.timeZone = patch.timeZone
      if (state.companion && typeof patch.name === 'string' && patch.name.trim()) state.companion.name = clip(patch.name, 12)
      if (state.companion && (patch.relation === 'friend' || patch.relation === 'lover')) state.companion.relation = patch.relation
      log('settings', patch)
      return s
    })
  }

  /* ------------------------------------------------------------- chat */

  /** Stable persona text for the system prompt. */
  personaText() {
    return personaSection(this.state)
  }

  /**
   * Per-turn snapshot for a Nook session. Also decides this turn's speaking plan
   * and remembers it for learning.
   */
  snapshot(sessionId, userText) {
    const state = this.state
    if (state.companion === undefined) return ''
    const recent = state.sessions[sessionId]?.phrasesUsed ?? []
    const hasOwn = state.notes.some((n) => n.status === 'ok' && this.now() - n.at < 7 * DAY)
    const plan = speechPlan(state.persona, userText, recent, this.random, { canShare: hasOwn })
    this.plans.set(sessionId, plan)
    // Recalled memories are reinforced inside stateSnapshot; persist that lazily.
    const text = stateSnapshot(state, { now: this.now(), timeZone: this.timeZone(), query: userText, sessionId, plan })
    // A reminder is said once; the reinforced memories are saved with it.
    void this.store.transact((st) => {
      st.reminder = ''
    })
    return text
  }

  /** A user message arrived in a Nook session. */
  userMessage(sessionId, text, at = this.now()) {
    return this.store.transact((state, log) => {
      const ev = log('chat.user', { text: clip(text, 2000) }, { sessionId, at })
      const gap = state.lastUserAt ? at - state.lastUserAt : 0
      const s = (state.sessions[sessionId] ??= { firstAt: at, lastAt: at, lastUser: '', lastReply: '', phrasesUsed: [] })
      s.lastAt = at
      s.lastUser = clip(text, 200)
      s.pendingUser = [...(s.pendingUser ?? []), { text: clip(text, 2000), ev: ev.id }]
      if (state.companion && gap > 2 * DAY) appraise(state, 'reunion', 0.6, `对方隔了 ${Math.round(gap / DAY)} 天回来了`, at, log)
      if (state.companion && state.outreach.unanswered > 0) this.creditOutreachReply(state, log)
      state.lastUserAt = at
      userReplied(state)
      if (state.companion && dayKey(at, this.timeZone()) !== state.lastTalkDay) {
        state.lastTalkDay = dayKey(at, this.timeZone())
        creditDay(state)
      }
      return ev
    })
  }

  creditOutreachReply(state, log) {
    const last = [...state.outreach.tasks].reverse().find((t) => t.status === 'delivered')
    if (last && !last.replied) {
      last.replied = true
      last.repliedAt = this.now()
      log('outreach.replied', { id: last.id, kind: last.kind, afterMs: last.repliedAt - last.deliveredAt })
    }
  }

  /** Nook's reply was committed in a session. Queues the digest of this exchange. */
  async assistantMessage(sessionId, text, at = this.now()) {
    const plan = this.plans.get(sessionId)
    const ev = await this.store.transact((state, log) => {
      const ev = log('chat.assistant', { text: clip(text, 2000), strategy: plan?.strategy, phrase: plan?.phrase }, { sessionId, at })
      const s = (state.sessions[sessionId] ??= { firstAt: at, lastAt: at, lastUser: '', lastReply: '', phrasesUsed: [] })
      s.previousReply = s.lastReply
      s.previousStrategy = s.lastStrategy
      s.lastReply = clip(text, 400)
      s.lastStrategy = plan?.strategy
      s.lastAt = at
      const used = state.persona?.catchphrases.map((c) => c.text).find((p) => text.includes(p)) ?? ''
      const claim = claimsReading(text)
      if (claim && !state.notes.some((n) => n.status === 'ok' && at - n.at < 14 * DAY)) {
        state.reminder = `你上一条说自己「${claim}」，但其实你没有读过这样的东西。不要编自己的经历；想聊这个就说"要不要我去查查"。`
        log('check.fabrication', { claim, sessionId })
      }
      s.phrasesUsed = [...(s.phrasesUsed ?? []), used].slice(-12)
      return ev
    })
    this.plans.delete(sessionId)
    await this.digest(sessionId)
    return ev
  }

  /**
   * Read the latest exchange: memories, threads, how it felt, and how the user
   * took her previous reply.
   */
  async digest(sessionId) {
    const state = this.state
    const s = state.sessions[sessionId]
    if (state.companion === undefined || !s?.pendingUser?.length) return
    const pending = s.pendingUser
    const userText = pending.map((p) => p.text).join('\n')
    const evidence = pending.at(-1).ev
    const now = this.now()
    // Lexical matches miss references like "不养了"; recent memories cover what the conversation is about.
    const relevant = retrieve(state, userText, now, 10)
    const recent = state.memories.filter((m) => m.status === 'active' && m.source !== 'self' && now - m.reinforcedAt < 7 * DAY).slice(-12)
    const sealed = state.memories.filter((m) => m.status === 'sealed').slice(-10)
    const shown = [...new Map([...relevant, ...recent, ...sealed].map((m) => [m.id, m])).values()]
    const prompt = digestPrompt({
      name: state.companion.name,
      now,
      timeZone: this.timeZone(),
      memories: shown,
      threads: state.threads.filter((t) => t.status === 'open' && t.owner === 'user'),
      previousReply: s.previousReply,
      userText,
      reply: s.lastReply,
    })
    const result = await this.call(prompt, 'digest')
    await this.store.transact((st, log) => {
      const session = st.sessions[sessionId]
      if (session) session.pendingUser = (session.pendingUser ?? []).filter((p) => !pending.some((q) => q.ev === p.ev))
      if (result === undefined) return
      const ops = (result.memories ?? []).map((op) => ({ ...op, dueAt: op.dueAt ? Date.parse(op.dueAt) : undefined }))
      const changed = applyMemoryOps(st, ops, now, evidence, log)
      applyThreadOps(st, result.threads, now, evidence, log, 'user')
      const gone = changed.filter((m) => m.status === 'invalid' || m.status === 'sealed').map((m) => m.id)
      if (gone.length) withdrawFor(st, gone, now, log)
      const a = result.appraisal
      if (a && a.kind && a.kind !== 'none') appraise(st, a.kind, Number(a.intensity), a.reason, now, log, a.feeling, evidence)
      else if (a?.feeling) st.mood = { ...moodNow(st.mood, st.persona.traits, now), label: clip(a.feeling, 8), reason: clip(a.reason, 40), at: now }
      const reaction = Number(result.reaction)
      if (Number.isFinite(reaction) && session?.previousStrategy) {
        learnStrategy(st.persona, session.previousStrategy, reaction)
        log('persona.learn', { strategy: session.previousStrategy, reaction })
      }
      const closeness = bondNow(st, now).closeness
      for (const phrase of Array.isArray(result.phrases) ? result.phrases.slice(0, 3) : []) notePhrase(st, phrase, 'user', closeness - 0.5, now)
      settleStage(st, now, log)
    })
  }

  /**
   * She used the search or fetch tool during a chat. That is real reading, done
   * just now with the user, and is recorded so she can refer to it truthfully.
   */
  chatLookup(sessionId, tool, args, resultText, at = this.now()) {
    let query = ''
    try {
      const parsed = JSON.parse(args)
      query = String(parsed.query ?? parsed.url ?? '')
    } catch {}
    if (!query) return
    const url = /https?:\/\/[^\s)\]"']+/.exec(resultText)?.[0] ?? ''
    return this.store.transact((state, log) => {
      state.notes.push({ id: newId('note'), at, status: 'ok', kind: 'chat', topic: query, query, title: clip(query, 40), url, takeaway: '', shareScore: 0, about: [], shared: true, sessionId })
      if (state.notes.length > 200) state.notes = state.notes.slice(-200)
      log('explore.chat', { tool, query, url }, { sessionId, at })
    })
  }

  /* ------------------------------------------------------------- tools */

  remember(text, type = 'fact') {
    return this.store.transact((state, log) => applyMemoryOps(state, [{ op: 'add', type, text, source: 'confirmed', importance: 0.7 }], this.now(), undefined, log)[0])
  }

  sealTopic(topic) {
    return this.store.transact((state, log) => {
      const n = sealTopic(state, topic, this.now(), log)
      const ids = state.memories.filter((m) => m.status === 'sealed').map((m) => m.id)
      withdrawFor(state, ids, this.now(), log, '对方不想再提')
      return n
    })
  }

  forget(id) {
    return this.store.transact((state, log) => forget(state, id, this.now(), log))
  }

  correct(id, text) {
    return this.store.transact((state, log) => applyMemoryOps(state, [{ op: 'update', id, text, source: 'confirmed', reason: '对方纠正' }], this.now(), undefined, log)[0])
  }

  invalidate(id, reason = '对方说不对了') {
    return this.store.transact((state, log) => {
      const changed = applyMemoryOps(state, [{ op: 'invalidate', id, reason }], this.now(), undefined, log)
      withdrawFor(state, changed.map((m) => m.id), this.now(), log)
      return changed[0]
    })
  }

  undoGrowth(id) {
    return this.store.transact((state, log) => {
      const ok = undoGrowth(state.persona, id)
      if (ok) log('persona.undo', { id })
      return ok
    })
  }

  /** Activity in a non-Nook session, so she does not interrupt work. */
  workActivity(at = this.now()) {
    if (at - this.state.lastWorkActivityAt < 60_000) return
    return this.store.transact((state) => {
      state.lastWorkActivityAt = at
    })
  }

  /* ------------------------------------------------------------- background */

  /** One pass of the background loop. Safe to call often; does at most one slow job. */
  async tick() {
    if (this.busy) return
    this.busy = true
    try {
      const state = this.state
      if (state.companion === undefined || !state.settings.enabled) return
      const now = this.now()
      if (!this.recovered) {
        this.recovered = true
        await this.recover()
      }
      if (now >= state.schedule.consolidate) return await this.consolidate()
      if (now >= state.schedule.growth) return await this.growth()
      if (state.settings.explore && now >= state.schedule.explore && !asleep(state, now, this.timeZone())) return await this.explore()
      await this.reachOut()
    } catch (error) {
      this.logger.warn(`nook: background job failed: ${error?.stack ?? error}`)
    } finally {
      this.busy = false
    }
  }

  /** Model call with the daily budget. Returns parsed JSON or undefined. */
  async call(prompt, purpose) {
    const state = this.state
    const day = dayKey(this.now(), this.timeZone())
    const used = state.budget.day === day ? state.budget.calls : 0
    if (purpose !== 'digest' && used >= state.settings.dailyBudgetCalls) return undefined
    await this.store.transact((st) => {
      if (st.budget.day !== day) st.budget = { day, calls: 0 }
      st.budget.calls += 1
    })
    try {
      return parseJson(await this.deps.llm({ ...prompt, purpose }))
    } catch (error) {
      this.logger.warn(`nook: ${purpose} call failed: ${error?.message ?? error}`)
      return undefined
    }
  }

  async explore() {
    const now = this.now()
    const state = this.state
    const topic = chooseTopic(state, now, this.random)
    const next = nextExploreAt(state, now, this.random)
    if (topic === undefined) {
      await this.store.transact((st) => {
        st.schedule.explore = next
      })
      return
    }
    const query = clip(topic.topic, 40)
    let result
    let failure
    try {
      result = await this.deps.search(query)
      if (!result?.sources?.length) failure = '没有搜到来源'
    } catch (error) {
      failure = error?.message ?? String(error)
    }
    let reading
    if (failure === undefined && this.deps.fetch) {
      // Open the first few results so her takeaway comes from the page, not the title.
      for (const source of result.sources.slice(0, 2)) {
        try {
          source.excerpt = clip(await this.deps.fetch(source.url), 2500) || undefined
        } catch {}
      }
    }
    if (failure === undefined) {
      const about = topic.about.map((id) => state.memories.find((m) => m.id === id)?.text).filter(Boolean).join('；')
      const answer = await this.call(
        notePrompt({ name: state.companion.name, query, sources: result.sources.slice(0, 6), content: result.content, interests: state.persona.interests.map((i) => i.topic), aboutUser: about || undefined }),
        'note',
      )
      const source = answer && !answer.none ? result.sources[Number(answer.index)] : undefined
      if (source?.url) reading = { ...answer, url: source.url, title: answer.title || source.title || source.url, snippet: source.snippet }
      else failure = '搜到的内容都不相关'
    }
    await this.store.transact((st, log) => {
      st.schedule.explore = next
      if (reading === undefined) {
        recordFailure(st, topic, query, failure, now, log)
        return
      }
      const note = recordReading(st, topic, query, reading, now, log)
      applyMemoryOps(st, [{ op: 'add', type: 'self', text: `读了《${note.title}》：${note.takeaway}`, source: 'self', importance: 0.4, keywords: [query] }], now, undefined, log)
    })
  }

  /** Try to reach out once: gate → candidate → her decision → durable delivery. */
  async reachOut() {
    const tz = this.timeZone()
    const now = this.now()
    let state = this.state
    if (gate(state, now, tz) !== undefined) return
    const candidate = candidates(state, now)[0]
    if (candidate === undefined) return
    const task = await this.store.transact((st, log) => plan(st, candidate, now, log))
    state = this.state
    const recent = Object.values(state.sessions).sort((a, b) => b.lastAt - a.lastAt)[0]
    const mood = moodNow(state.mood, state.persona.traits, now)
    const decision = await this.call(
      decidePrompt({
        name: state.companion.name,
        persona: personaSection(state).split('\n')[0],
        now: describeNow(now, tz),
        mood: mood.label,
        relation: STAGES[state.companion.relation][state.bond.stage ?? 0],
        brief: task.brief,
        recent: recent ? { user: recent.lastUser, you: recent.lastReply } : null,
      }),
      'decide',
    )
    if (!decision?.speak) {
      await this.store.transact((st, log) => settle(st, findTask(st, task.id), 'silent', this.now(), log))
      return
    }
    await this.deliver(task.id, decision.angle)
  }

  /** Durable delivery: re-check, mark delivering, deliver, mark delivered. */
  async deliver(taskId, angle) {
    const tz = this.timeZone()
    const ready = await this.store.transact((st, log) => {
      const task = findTask(st, taskId)
      if (task === undefined || (task.status !== 'planned' && task.status !== 'delivering')) return undefined
      if (!stillValid(st, task)) {
        settle(st, task, 'withdrawn', this.now(), log, { reason: '发出前发现已经不成立' })
        return undefined
      }
      const blocked = gate(st, this.now(), tz)
      if (blocked !== undefined && task.status === 'planned') {
        settle(st, task, 'skipped', this.now(), log, { reason: blocked })
        return undefined
      }
      task.status = 'delivering'
      task.deliveringAt = this.now()
      if (angle) task.angle = clip(angle, 80)
      log('outreach.delivering', { id: task.id })
      return { ...task }
    })
    if (ready === undefined) return
    const text = outreachText(ready)
    const receipt = await this.deps.deliver({ taskId: ready.id, text, summary: summaryOf(ready) })
    await this.store.transact((st, log) => {
      const task = findTask(st, taskId)
      if (task === undefined) return
      if (receipt === undefined) settle(st, task, 'skipped', this.now(), log, { reason: '没有可以发送的会话' })
      else settle(st, task, 'delivered', this.now(), log, { sessionId: receipt.sessionId, messageId: receipt.messageId })
    })
  }

  /** After a restart: settle tasks that were mid-delivery. */
  async recover() {
    const stuck = this.state.outreach.tasks.filter((t) => t.status === 'delivering')
    for (const task of stuck) {
      const done = await this.deps.wasDelivered?.(task.id)
      if (done) {
        await this.store.transact((st, log) => settle(st, findTask(st, task.id), 'delivered', this.now(), log, { recovered: true }))
      } else if (this.now() - task.deliveringAt < 6 * HOUR) {
        await this.deliver(task.id)
      } else {
        await this.store.transact((st, log) => settle(st, findTask(st, task.id), 'skipped', this.now(), log, { reason: '重启后已过时' }))
      }
    }
  }

  /** Nightly: the day card, memory upkeep, catchphrases, relationship stage. */
  async consolidate() {
    const tz = this.timeZone()
    const now = this.now()
    const state = this.state
    const date = dayKey(now - 6 * HOUR, tz)
    const since = now - DAY
    const events = await this.store.events((e) => e.at >= since && DAY_EVENTS.has(e.kind))
    let card
    if (events.length > 0 && !state.days.some((d) => d.date === date)) {
      card = await this.call(dayCardPrompt({ name: state.companion.name, date, events: events.map(eventLine) }), 'day')
    }
    await this.store.transact((st, log) => {
      st.schedule.consolidate = nextAt(now, tz, st.settings.sleep.start) ?? now + DAY
      if (card?.summary) {
        const evidence = events.filter((e) => e.kind === 'chat.user' || e.kind === 'explore.read').map((e) => e.id)
        st.days.push({ date, title: clip(card.title, 20), summary: clip(card.summary, 200), feeling: clip(card.feeling, 60), evidence, at: now })
        if (st.days.length > 400) st.days = st.days.slice(-400)
        for (const m of Array.isArray(card.moments) ? card.moments.slice(0, 2) : []) {
          applyMemoryOps(st, [{ op: 'add', type: 'moment', text: m, source: 'confirmed', importance: 0.7 }], now, evidence.at(-1), log)
        }
        log('day.card', { date, title: card.title })
      }
      consolidateMemories(st, now, log)
      consolidateThreads(st, now, log)
      coolInterests(st)
      settlePhrases(st, bondNow(st, now).closeness, now)
      settleStage(st, now, log)
      st.reminder = ''
    })
  }

  /** Weekly: small, evidence-backed personality change. */
  async growth() {
    const now = this.now()
    const state = this.state
    const days = state.days.slice(-7).map((d) => ({ date: d.date, summary: d.summary, feeling: d.feeling }))
    const learned = await this.store.events((e) => e.kind === 'persona.learn' && e.at > now - 7 * DAY)
    let answer
    if (days.length >= 3) answer = await this.call(growthPrompt({ name: state.companion.name, traits: state.persona.traits, days, reactions: learned.map((e) => e.data) }), 'growth')
    await this.store.transact((st, log) => {
      st.schedule.growth = now + 7 * DAY
      const applied = applyGrowth(st.persona, answer?.changes, now)
      if (applied.length) log('persona.grow', { changes: applied })
    })
  }

  /* ------------------------------------------------------------- views */

  /** Everything the UI shows. */
  view() {
    const state = this.state
    const now = this.now()
    if (state.companion === undefined) return { ready: false, settings: state.settings }
    const bond = bondNow(state, now)
    const stages = STAGES[state.companion.relation]
    return {
      ready: true,
      companion: state.companion,
      settings: state.settings,
      mbti: mbtiOf(state.persona.traits),
      traits: state.persona.traits,
      mood: moodNow(state.mood, state.persona.traits, now),
      bond: { closeness: bond.closeness, grudge: bond.grudge, hurt: bond.hurt?.reason, stage: state.bond.stage ?? 0, stages, changes: recentChanges(state, now) },
      growth: state.persona.growth.slice(-10).reverse(),
      catchphrases: state.persona.catchphrases,
      interests: state.persona.interests.slice(0, 8),
      memories: state.memories.filter((m) => m.status !== 'forgotten').slice(-300).reverse(),
      threads: state.threads.slice(-60).reverse(),
      days: state.days.slice(-60).reverse(),
      notes: state.notes.slice(-40).reverse(),
      know: knowMap(state, now),
      outreach: state.outreach.tasks.slice(-20).reverse(),
      asleep: asleep(state, now, this.timeZone()),
      sessions: Object.entries(state.sessions).sort((a, b) => (b[1].lastAt ?? 0) - (a[1].lastAt ?? 0)).map(([id]) => id),
      scene: sceneOf(state, now, this.timeZone()),
    }
  }

  /** What she remembers that bears on one conversation, for the chat drawer. */
  related(sessionId) {
    const state = this.state
    const now = this.now()
    const s = state.sessions[sessionId]
    const query = s ? `${s.lastUser ?? ''} ${s.lastReply ?? ''}` : ''
    return {
      mood: moodNow(state.mood, state.persona?.traits, now),
      threads: state.threads.filter((t) => t.owner === 'user' && t.status === 'open').slice(-5).reverse(),
      memories: query.trim() ? retrieve(state, query, now, 8).filter((m) => m.status === 'active') : [],
      recent: state.memories.filter((m) => m.status === 'active' && m.source !== 'self').slice(-4).reverse(),
    }
  }

  /** The original lines behind a memory, from the event log. */
  async evidence(ids) {
    const want = new Set(ids)
    const found = await this.store.events((e) => want.has(e.id))
    return found.map((e) => ({ id: e.id, at: e.at, kind: e.kind, text: e.data?.text ?? e.data?.title ?? '' }))
  }
}

/**
 * Whether a reply claims she read or saw something ("刷到一篇…"). Returns the
 * phrase, or '' when there is no such claim.
 */
export function claimsReading(text) {
  const m = /(刚好|前几天|昨天|今天|之前|最近)?(刷到|看到|读到|看了|读了|翻到)(过)?(一篇|一个|一条|篇|个)?(文章|帖子|视频|讲|说)/.exec(String(text))
  return m ? m[0] : ''
}

const DAY_EVENTS = new Set(['chat.user', 'chat.assistant', 'explore.read', 'explore.fail', 'outreach.delivered', 'memory.invalidate', 'thread.open', 'thread.close', 'affect'])

function eventLine(e) {
  const t = new Date(e.at).toISOString().slice(11, 16)
  switch (e.kind) {
    case 'chat.user':
      return `${t} 对方说：${clip(e.data.text, 120)}`
    case 'chat.assistant':
      return `${t} 我说：${clip(e.data.text, 120)}`
    case 'explore.read':
      return `${t} 我读了《${e.data.title}》，觉得：${e.data.takeaway}`
    case 'explore.fail':
      return `${t} 我想查「${e.data.query}」，没搜到`
    case 'outreach.delivered':
      return `${t} 我主动找了对方`
    case 'memory.invalidate':
      return `${t} 我知道了「${e.data.text}」已经不成立：${e.data.reason ?? ''}`
    case 'thread.open':
      return `${t} 对方开始了一件事：${e.data.title}`
    case 'thread.close':
      return `${t} 一件事有了结果：${e.data.title}，${e.data.outcome ?? ''}`
    case 'affect':
      return `${t} 我的心情：${e.data.mood}（${e.data.reason}）`
    default:
      return `${t} ${e.kind}`
  }
}

/** Which version of the header scene fits her state right now. */
function sceneOf(state, now, timeZone) {
  if (asleep(state, now, timeZone)) return 'sleep'
  if (state.notes.some((n) => n.status === 'ok' && n.kind !== 'chat' && now - n.at < 90 * 60_000)) return 'reading'
  if (state.lastUserAt && now - state.lastUserAt > missAfterHours(state.persona?.traits) * HOUR * 0.6) return 'miss'
  return 'idle'
}

function findTask(state, id) {
  return state.outreach.tasks.find((t) => t.id === id)
}

/** The model-facing instruction carried by an outreach message. */
export function outreachText(task) {
  return [
    `[Nook 主动消息 ${task.id}]`,
    '现在不是对方在找你，是你自己想主动给对方发消息。',
    `起因：${task.brief}`,
    task.angle ? `你打算这样开口：${task.angle}` : '',
    '用你平时的口吻直接发给对方，一到三句，像发微信一样自然。不要提到"系统""提醒""任务"这些词，也不要解释你为什么发。',
  ]
    .filter(Boolean)
    .join('\n')
}

function summaryOf(task) {
  return { thread: '想起你们之前聊的事', promise: '有个日子快到了', note: '读到一篇想分享的', miss: '有点想你' }[task.kind] ?? '想找你聊聊'
}

export { newId }
