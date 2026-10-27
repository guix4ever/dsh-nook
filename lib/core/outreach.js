/**
 * Reaching out first.
 *
 * Code decides *whether it is a good time* (her sleep, the user's work, how
 * often, how many unanswered); the model, as her, decides *whether she wants to*
 * and what to say — and may stay silent. A task is written down before it is
 * delivered and marked delivered only after the session has it on disk, so a
 * crash in between is detected and settled on restart instead of sending twice.
 */
import { newId } from './store.js'
import { HOUR, DAY, inWindow, dayKey } from './clock.js'
import { dueThreads } from './threads.js'
import { duePromises } from './memory.js'

export const FREQUENCY = {
  low: { gapHours: 6, perDay: 1 },
  medium: { gapHours: 3, perDay: 3 },
  high: { gapHours: 1.5, perDay: 5 },
}

/** Whether she is asleep now (her sleep hours double as the user's quiet hours). */
export function asleep(state, now, timeZone) {
  const s = state.settings.sleep
  return inWindow(now, timeZone, s.start, s.end)
}

/** Hours of silence after which she starts to miss the user: sooner if she needs replies more. */
export function missAfterHours(traits) {
  const need = 0.6 * (traits?.N ?? 0.5) + 0.4 * (traits?.E ?? 0.5)
  return 36 - 20 * need
}

/** Candidate reasons to reach out now, best first. */
export function candidates(state, now) {
  const busy = new Set(
    state.outreach.tasks
      .filter((t) => (t.status === 'planned' || t.status === 'delivering') || (t.status === 'delivered' && now - t.deliveredAt < DAY))
      .map((t) => t.ref),
  )
  const out = []
  for (const t of dueThreads(state, now)) {
    out.push({ kind: 'thread', ref: t.id, score: 1.2, brief: `之前对方提过「${t.title}」，进展是「${t.stage}」，现在可以关心一下后来怎么样了。` })
  }
  for (const m of duePromises(state, now, DAY)) {
    out.push({ kind: 'promise', ref: m.id, score: 1.1, brief: `你们之间有件事快到了：「${m.text}」。` })
  }
  for (const n of state.notes) {
    if (n.shared || n.status !== 'ok' || now - n.at > 3 * DAY || (n.shareScore ?? 0) < 0.6) continue
    if (n.about && !relatedStillValid(state, n.about)) continue
    out.push({
      kind: 'note',
      ref: n.id,
      score: n.shareScore,
      brief: `你自己读到了一篇「${n.title}」（${n.url}），你的感受是：「${n.takeaway}」。${n.why ? `你觉得对方会感兴趣，因为：${n.why}` : ''}`,
    })
  }
  const silence = now - (state.lastUserAt || now)
  const lastMiss = Math.max(0, ...state.outreach.tasks.filter((t) => t.kind === 'miss').map((t) => t.createdAt))
  if (state.lastUserAt && silence > missAfterHours(state.persona?.traits) * HOUR && now - lastMiss > 2 * DAY && state.outreach.unanswered === 0) {
    out.push({ kind: 'miss', ref: `miss:${dayKey(now, state.settings.timeZone)}`, score: 0.7, brief: `对方已经 ${Math.round(silence / HOUR)} 小时没来找你了，你有点想对方。` })
  }
  return out.filter((c) => !busy.has(c.ref)).sort((a, b) => b.score - a.score)
}

function relatedStillValid(state, memoryIds) {
  return memoryIds.every((id) => {
    const m = state.memories.find((x) => x.id === id)
    return m === undefined || m.status === 'active'
  })
}

/** Code-side gate. Returns undefined when she may reach out now, else the reason not to. */
export function gate(state, now, timeZone) {
  const s = state.settings
  if (!s.enabled || state.companion === undefined) return '未启用'
  if (asleep(state, now, timeZone)) return '她在睡觉'
  const f = FREQUENCY[s.outreach] ?? FREQUENCY.medium
  const day = dayKey(now, timeZone)
  const sentToday = state.outreach.sentToday.day === day ? state.outreach.sentToday.count : 0
  if (sentToday >= f.perDay) return '今天已经找过够多次了'
  if (state.outreach.unanswered >= 3) return '连续几次没回，先等对方'
  const gap = f.gapHours * HOUR * Math.pow(2, state.outreach.unanswered)
  if (now - state.outreach.lastSentAt < gap) return '离上次主动找太近'
  if (now - state.lastUserAt < 20 * 60_000) return '正在聊天'
  if (s.respectWork && now - state.lastWorkActivityAt < 15 * 60_000) return '对方在忙工作'
  return undefined
}

/** Create a planned task for a candidate. */
export function plan(state, candidate, now, log) {
  const task = {
    id: newId('out'),
    kind: candidate.kind,
    ref: candidate.ref,
    brief: candidate.brief,
    status: 'planned',
    createdAt: now,
  }
  state.outreach.tasks.push(task)
  if (state.outreach.tasks.length > 300) state.outreach.tasks = state.outreach.tasks.slice(-300)
  log('outreach.plan', { id: task.id, kind: task.kind, ref: task.ref })
  return task
}

/** Whether the task's subject still holds (the user may have changed their mind since). */
export function stillValid(state, task) {
  if (task.kind === 'thread') return state.threads.some((t) => t.id === task.ref && t.status === 'open')
  if (task.kind === 'promise') return state.memories.some((m) => m.id === task.ref && m.status === 'active' && !m.done)
  if (task.kind === 'note') {
    const n = state.notes.find((x) => x.id === task.ref)
    return n !== undefined && !n.shared && (!n.about || relatedStillValid(state, n.about))
  }
  return true
}

export function settle(state, task, status, now, log, extra = {}) {
  Object.assign(task, extra, { status, settledAt: now })
  if (status === 'delivered') {
    task.deliveredAt = now
    state.outreach.lastSentAt = now
    state.outreach.unanswered += 1
    const day = dayKey(now, state.settings.timeZone)
    if (state.outreach.sentToday.day !== day) state.outreach.sentToday = { day, count: 0 }
    state.outreach.sentToday.count += 1
    if (task.kind === 'note') {
      const n = state.notes.find((x) => x.id === task.ref)
      if (n) n.shared = true
    }
    if (task.kind === 'thread') {
      const t = state.threads.find((x) => x.id === task.ref)
      if (t) t.lastAskedAt = now
    }
  }
  log(`outreach.${status}`, { id: task.id, kind: task.kind, ref: task.ref, ...extra })
}

/**
 * Withdraw pending tasks and unshared notes tied to memories that just became
 * invalid or sealed — "不养了" must stop the cat articles.
 * @returns ids of withdrawn tasks.
 */
export function withdrawFor(state, memoryIds, now, log, reason = '相关的事已经不成立了') {
  const ids = new Set(memoryIds)
  if (ids.size === 0) return []
  const withdrawn = []
  for (const n of state.notes) {
    if (!n.shared && n.status === 'ok' && (n.about ?? []).some((id) => ids.has(id))) {
      n.status = 'withdrawn'
      log('note.withdraw', { id: n.id, title: n.title, reason })
    }
  }
  for (const t of state.outreach.tasks) {
    if (t.status !== 'planned') continue
    if (!stillValid(state, t)) {
      settle(state, t, 'withdrawn', now, log, { reason })
      withdrawn.push(t.id)
    }
  }
  return withdrawn
}

/** The user said something: reset the unanswered count. */
export function userReplied(state) {
  state.outreach.unanswered = 0
}
