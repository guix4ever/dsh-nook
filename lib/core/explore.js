/**
 * Her own time: picking something to look into, reading it, and keeping a note
 * of what she thought. A search counts as "read" only when it returned a source;
 * a failed search is recorded as a failure, never turned into an experience.
 */
import { newId } from './store.js'
import { DAY, HOUR } from './clock.js'
import { clip, similarity } from './text.js'

/** Topics she could look into now, each with a weight and, if about the user, the memories behind it. */
export function topicPool(state, now) {
  const pool = []
  for (const i of state.persona?.interests ?? []) {
    if (i.weight > 0.05) pool.push({ topic: i.topic, weight: i.weight, about: [] })
  }
  for (const t of state.threads) {
    if (t.status !== 'open' || t.owner !== 'user' || now - t.updatedAt > 7 * DAY) continue
    const about = state.memories.filter((m) => m.status === 'active' && m.source !== 'self' && similarity(m.text, t.title) >= 0.3).map((m) => m.id)
    pool.push({ topic: t.title, weight: 0.9, about, thread: t.id })
  }
  for (const m of state.memories) {
    if (m.status !== 'active' || m.source === 'self') continue
    if ((m.type === 'preference' || m.type === 'event' || m.type === 'fact') && (m.importance ?? 0) >= 0.5 && now - m.createdAt < 14 * DAY) {
      pool.push({ topic: (m.keywords?.length ? m.keywords.join(' ') : m.text), weight: 0.6 + 0.4 * (m.importance ?? 0.5), about: [m.id] })
    }
  }
  // Merge entries about the same thing so one topic carries all its memories.
  const merged = []
  for (const p of pool) {
    const twin = merged.find((q) => similarity(q.topic, p.topic) >= 0.5)
    if (twin === undefined) merged.push({ ...p, about: [...p.about] })
    else {
      twin.weight = Math.max(twin.weight, p.weight)
      for (const id of p.about) if (!twin.about.includes(id)) twin.about.push(id)
    }
  }
  // Recently explored topics rest for two days.
  const recent = state.notes.filter((n) => now - n.at < 2 * DAY)
  return merged.filter((p) => !recent.some((n) => similarity(n.topic, p.topic) >= 0.6))
}

/**
 * Pick a topic. Openness spreads the choice: an open Nook wanders, a less open
 * one keeps returning to what she already likes.
 */
export function chooseTopic(state, now, random = Math.random) {
  const pool = topicPool(state, now)
  if (pool.length === 0) return undefined
  const o = state.persona?.traits?.O ?? 0.5
  const temperature = 0.3 + 0.7 * o
  const w = pool.map((p) => Math.exp(p.weight / temperature))
  let pick = random() * w.reduce((a, b) => a + b, 0)
  for (let i = 0; i < pool.length; i += 1) {
    pick -= w[i]
    if (pick <= 0) return pool[i]
  }
  return pool.at(-1)
}

/** Record a failed search honestly. */
export function recordFailure(state, topic, query, error, now, log) {
  const note = { id: newId('note'), at: now, status: 'failed', topic: topic.topic, query, error: clip(error, 80), about: topic.about ?? [] }
  state.notes.push(note)
  trim(state)
  log('explore.fail', { id: note.id, query, error: note.error })
  return note
}

/**
 * Record what she read and thought.
 * @param reading - { title, url, snippet, takeaway, shareScore, why, interests[] } from the note-writing model.
 */
export function recordReading(state, topic, query, reading, now, log) {
  const note = {
    id: newId('note'),
    at: now,
    status: 'ok',
    topic: topic.topic,
    query,
    title: clip(reading.title, 60),
    url: String(reading.url ?? ''),
    snippet: clip(reading.snippet, 160),
    takeaway: clip(reading.takeaway, 120),
    shareScore: Math.max(0, Math.min(1, Number(reading.shareScore) || 0)),
    why: clip(reading.why, 60),
    about: topic.about ?? [],
    shared: false,
  }
  state.notes.push(note)
  trim(state)
  bumpInterest(state, topic.topic, 0.1)
  for (const extra of Array.isArray(reading.interests) ? reading.interests.slice(0, 2) : []) bumpInterest(state, extra, 0.05)
  log('explore.read', { id: note.id, title: note.title, url: note.url, takeaway: note.takeaway })
  return note
}

export function bumpInterest(state, topic, amount) {
  const name = clip(topic, 16)
  if (!name) return
  const list = state.persona.interests
  let entry = list.find((i) => i.topic === name || similarity(i.topic, name) >= 0.7)
  if (entry === undefined) {
    entry = { topic: name, weight: 0 }
    list.push(entry)
  }
  entry.weight = Math.max(0, Math.min(1.5, entry.weight + amount))
  list.sort((a, b) => b.weight - a.weight)
  if (list.length > 20) list.length = 20
}

/** Nightly: interests cool a little unless fed. */
export function coolInterests(state) {
  for (const i of state.persona?.interests ?? []) i.weight *= 0.95
}

function trim(state) {
  if (state.notes.length > 200) state.notes = state.notes.slice(-200)
}

/** Next time to explore: 2–4 times a day at random times while she is awake. */
export function nextExploreAt(state, now, random = Math.random) {
  const perDay = 2 + Math.round(2 * (state.persona?.traits?.O ?? 0.5))
  const mean = (16 * HOUR) / perDay
  return now + mean * (0.6 + 0.8 * random())
}
