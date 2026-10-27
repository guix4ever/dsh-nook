/**
 * Long-term memory items.
 *
 * Each item says where it came from (`source`) and whether it still holds
 * (`status`), because a companion that states a guess as fact, or keeps pushing
 * something the user has moved on from, breaks trust faster than one that forgets.
 *
 *   source  confirmed — the user said it
 *           inferred  — Nook guessed it; may only be raised as a question
 *           self      — Nook's own experience (something she read or did)
 *   status  active | invalid (no longer true) | sealed (do not bring up) | forgotten
 *
 * Strength decays with time. Important and emotional things fade slowly, guesses
 * fade fast, and an open promise does not fade until it is due.
 */
import { newId } from './store.js'
import { DAY } from './clock.js'
import { tokenSet, overlap, similarity, clip } from './text.js'
import { KNOW_AREAS } from './state.js'

export const MEMORY_TYPES = {
  fact: '事实',
  preference: '偏好',
  event: '经历',
  promise: '约定',
  moment: '共同回忆',
  self: '她自己的经历',
  opinion: '她的看法',
}
export const SOURCES = { confirmed: '已确认', inferred: '推测', self: '她的经历' }

const clamp01 = (x) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0))

/** Days for an item's strength to halve. */
export function halfLifeDays(item) {
  const importance = clamp01(item.importance ?? 0.5)
  const intensity = clamp01(item.emotion?.intensity ?? 0)
  const base = item.source === 'inferred' ? 6 : 20
  return base * (1 + 3 * importance) * (1 + 2 * intensity)
}

/** 0–1: how present this memory still is. */
export function strengthOf(item, now) {
  if (item.status !== 'active') return 0
  if (item.type === 'promise' && !item.done && (item.dueAt === undefined || now < item.dueAt + 3 * DAY)) return 1
  const since = Math.max(0, now - (item.reinforcedAt ?? item.createdAt)) / DAY
  return Math.pow(0.5, since / halfLifeDays(item))
}

function searchText(item) {
  return `${item.text} ${(item.keywords ?? []).join(' ')}`
}

function sealedMatch(state, text) {
  const set = tokenSet(text)
  return (state.memories ?? []).some((m) => m.status === 'sealed' && overlap(tokenSet(searchText(m)), set) >= 0.5)
}

/**
 * Apply operations proposed by the extraction model.
 *
 * `add` turns into `update` when an active item of the same type already says
 * nearly the same thing; anything touching a sealed topic is dropped.
 * @param ops - [{ op, id?, type, text, source, area, importance, emotion, keywords, dueAt, reason }]
 * @param evidence - event id that justifies the change.
 * @returns the items that changed.
 */
export function applyMemoryOps(state, ops, now, evidence, log) {
  const changed = []
  for (const raw of Array.isArray(ops) ? ops : []) {
    const op = raw?.op
    const text = clip(raw?.text, 200)
    if (op === 'add') {
      if (!text || !MEMORY_TYPES[raw.type]) continue
      if (sealedMatch(state, text)) continue
      const twin = state.memories.find(
        (m) => m.status === 'active' && m.type === raw.type && similarity(searchText(m), text) >= 0.6,
      )
      if (twin !== undefined) {
        reinforce(twin, now)
        if (raw.source === 'confirmed' && twin.source === 'inferred') {
          twin.source = 'confirmed'
          log('memory.confirm', { id: twin.id, text: twin.text, evidence })
        }
        changed.push(twin)
        continue
      }
      const item = {
        id: newId('mem'),
        type: raw.type,
        text,
        source: SOURCES[raw.source] ? raw.source : 'inferred',
        status: 'active',
        area: KNOW_AREAS[raw.area] ? raw.area : undefined,
        importance: clamp01(raw.importance ?? 0.5),
        emotion: { valence: Math.max(-1, Math.min(1, raw.emotion?.valence ?? 0)), intensity: clamp01(raw.emotion?.intensity ?? 0) },
        keywords: Array.isArray(raw.keywords) ? raw.keywords.slice(0, 6).map(String) : [],
        createdAt: now,
        reinforcedAt: now,
        recalls: 0,
        evidence: evidence ? [evidence] : [],
        history: [],
        ...(raw.type === 'promise' && Number.isFinite(raw.dueAt) ? { dueAt: raw.dueAt } : {}),
      }
      state.memories.push(item)
      log('memory.add', { id: item.id, type: item.type, text: item.text, source: item.source, evidence })
      changed.push(item)
      continue
    }
    const target = findTarget(state, raw)
    if (target === undefined) continue
    if (op === 'update' && text) {
      target.history.push({ text: target.text, at: now, reason: clip(raw.reason, 80) })
      target.text = text
      if (raw.source === 'confirmed') target.source = 'confirmed'
      reinforce(target, now)
      if (evidence) target.evidence.push(evidence)
      log('memory.update', { id: target.id, from: target.history.at(-1).text, to: text, evidence })
      changed.push(target)
    } else if (op === 'invalidate') {
      target.status = 'invalid'
      target.invalidAt = now
      target.invalidReason = clip(raw.reason, 80)
      if (evidence) target.evidence.push(evidence)
      log('memory.invalidate', { id: target.id, text: target.text, reason: target.invalidReason, evidence })
      changed.push(target)
    } else if (op === 'seal') {
      target.status = 'sealed'
      target.sealedAt = now
      log('memory.seal', { id: target.id, evidence })
      changed.push(target)
    } else if (op === 'done' && target.type === 'promise') {
      target.done = true
      reinforce(target, now)
      log('memory.done', { id: target.id, text: target.text, evidence })
      changed.push(target)
    }
  }
  return changed
}

/** Find the item an op refers to: by id, or by close text match among live items. */
function findTarget(state, raw) {
  if (typeof raw?.id === 'string') {
    const byId = state.memories.find((m) => m.id === raw.id)
    if (byId !== undefined) return byId
  }
  const probe = raw?.match ?? raw?.text
  if (!probe) return undefined
  let best
  let bestScore = 0.5
  for (const m of state.memories) {
    if (m.status !== 'active' && m.status !== 'sealed') continue
    const score = similarity(searchText(m), probe)
    if (score > bestScore) {
      best = m
      bestScore = score
    }
  }
  return best
}

export function reinforce(item, now) {
  item.reinforcedAt = now
  item.recalls = (item.recalls ?? 0) + 1
}

/** Seal a topic directly ("别提了"): every live item that matches, plus a marker for future mentions. */
export function sealTopic(state, topic, now, log) {
  const set = tokenSet(topic)
  const hit = state.memories.filter((m) => m.status === 'active' && overlap(set, tokenSet(searchText(m))) >= 0.5)
  for (const m of hit) {
    m.status = 'sealed'
    m.sealedAt = now
  }
  const marker = {
    id: newId('mem'),
    type: 'fact',
    text: clip(topic, 60),
    source: 'confirmed',
    status: 'sealed',
    importance: 0.5,
    emotion: { valence: 0, intensity: 0 },
    keywords: [],
    createdAt: now,
    reinforcedAt: now,
    sealedAt: now,
    recalls: 0,
    evidence: [],
    history: [],
  }
  state.memories.push(marker)
  log('memory.seal', { topic: marker.text, ids: hit.map((m) => m.id) })
  return hit.length
}

/** Remove an item's content at the user's request. */
export function forget(state, id, now, log) {
  const item = state.memories.find((m) => m.id === id)
  if (item === undefined) return false
  item.status = 'forgotten'
  item.text = ''
  item.keywords = []
  item.history = []
  item.forgottenAt = now
  log('memory.forget', { id })
  return true
}

/**
 * Memories relevant to `query`, best first. Sealed items surface only when the
 * query itself is about them (the user brought it up).
 */
export function retrieve(state, query, now, limit = 6) {
  const q = tokenSet(query)
  if (q.size === 0) return []
  const scored = []
  for (const m of state.memories) {
    const sealed = m.status === 'sealed'
    if (m.status !== 'active' && !sealed) continue
    const rel = overlap(q, tokenSet(searchText(m)))
    if (rel < (sealed ? 0.5 : 0.15)) continue
    const strength = sealed ? 0.5 : strengthOf(m, now)
    scored.push({ item: m, score: rel * (0.4 + 0.6 * strength) + 0.1 * (m.importance ?? 0.5) })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.item)
}

/** The short "个人档案": the confirmed facts and preferences that matter most. */
export function profile(state, now, maxChars = 320) {
  const core = state.memories
    .filter((m) => m.status === 'active' && m.source === 'confirmed' && (m.type === 'fact' || m.type === 'preference'))
    .map((m) => ({ m, score: (m.importance ?? 0.5) * (0.5 + 0.5 * strengthOf(m, now)) + 0.05 * Math.min(5, m.recalls ?? 0) }))
    .sort((a, b) => b.score - a.score)
  const lines = []
  let used = 0
  for (const { m } of core) {
    if (used + m.text.length > maxChars) break
    lines.push(m.text)
    used += m.text.length
  }
  return lines
}

/** Open promises whose due time is within `withinMs` (or already passed but not done). */
export function duePromises(state, now, withinMs = 2 * DAY) {
  return state.memories.filter(
    (m) => m.status === 'active' && m.type === 'promise' && !m.done && m.dueAt !== undefined && m.dueAt - now <= withinMs,
  )
}

/** How well Nook knows each area: 0 unknown … 3 well known. */
export function knowMap(state, now) {
  const out = {}
  for (const area of Object.keys(KNOW_AREAS)) {
    const items = state.memories.filter((m) => m.status === 'active' && m.area === area && m.source !== 'self')
    const weight = items.reduce((sum, m) => sum + (m.source === 'confirmed' ? 1 : 0.4) * (0.5 + 0.5 * strengthOf(m, now)), 0)
    out[area] = weight >= 6 ? 3 : weight >= 3 ? 2 : weight >= 0.8 ? 1 : 0
  }
  return out
}

/** Nightly upkeep: fade weak inferred items out of the active set and close stale promises. */
export function consolidate(state, now, log) {
  let faded = 0
  for (const m of state.memories) {
    if (m.status !== 'active') continue
    if (m.source === 'inferred' && strengthOf(m, now) < 0.05) {
      m.status = 'invalid'
      m.invalidAt = now
      m.invalidReason = '太久没被证实，淡忘了'
      faded += 1
    }
    if (m.type === 'promise' && !m.done && m.dueAt !== undefined && now > m.dueAt + 7 * DAY) {
      m.done = true
    }
  }
  if (faded > 0) log('memory.fade', { count: faded })
  return faded
}

/** One line per memory for the model, labelled with how it may be used. */
export function renderMemory(item) {
  if (item.status === 'sealed') return `- [封存：对方说过不想提，除非对方自己提起] ${item.text}`
  const tag =
    item.source === 'inferred' ? '推测，只能试探着问，不要当成事实' : item.source === 'self' ? '你自己的经历' : '对方说过'
  const was = item.history?.length ? `（以前：${item.history.at(-1).text}）` : ''
  return `- [${tag}] ${item.text}${was}`
}
