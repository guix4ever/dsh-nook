/**
 * Threads: things that have a "后来呢". An interview, a move, a fight with a
 * friend — and Nook's own ongoing interests. Each thread knows its current stage
 * and when it is worth asking again, which is what lets her pick up where the
 * last conversation left off instead of remembering isolated facts.
 */
import { newId } from './store.js'
import { HOUR, DAY } from './clock.js'
import { clip, similarity } from './text.js'

const MAX_OPEN = 24

/**
 * Apply thread operations from the extraction model.
 * @param ops - [{ op: 'open'|'update'|'close', id?, title, stage, checkInHours?, outcome? }]
 */
export function applyThreadOps(state, ops, now, evidence, log, owner = 'user') {
  const changed = []
  for (const raw of Array.isArray(ops) ? ops : []) {
    const title = clip(raw?.title, 40)
    const stage = clip(raw?.stage, 80)
    const checkAt = Number.isFinite(raw?.checkInHours) && raw.checkInHours > 0 ? now + raw.checkInHours * HOUR : undefined
    if (raw?.op === 'open') {
      if (!title) continue
      const twin = find(state, raw, owner)
      if (twin !== undefined && twin.status === 'open') {
        update(twin, stage, checkAt, now, evidence)
        log('thread.update', { id: twin.id, title: twin.title, stage: twin.stage, evidence })
        changed.push(twin)
        continue
      }
      const thread = {
        id: newId('th'),
        owner,
        title,
        stage: stage || '刚开始',
        status: 'open',
        createdAt: now,
        updatedAt: now,
        nextCheckAt: checkAt ?? now + DAY,
        lastAskedAt: 0,
        evidence: evidence ? [evidence] : [],
      }
      state.threads.push(thread)
      log('thread.open', { id: thread.id, title, stage: thread.stage, evidence })
      changed.push(thread)
    } else if (raw?.op === 'update') {
      const t = find(state, raw, owner)
      if (t === undefined || t.status !== 'open') continue
      update(t, stage, checkAt, now, evidence)
      log('thread.update', { id: t.id, title: t.title, stage: t.stage, evidence })
      changed.push(t)
    } else if (raw?.op === 'close') {
      const t = find(state, raw, owner)
      if (t === undefined || t.status !== 'open') continue
      t.status = 'closed'
      t.closedAt = now
      t.outcome = clip(raw.outcome ?? stage, 80)
      t.updatedAt = now
      if (evidence) t.evidence.push(evidence)
      log('thread.close', { id: t.id, title: t.title, outcome: t.outcome, evidence })
      changed.push(t)
    }
  }
  trim(state)
  return changed
}

function update(t, stage, checkAt, now, evidence) {
  if (stage) t.stage = stage
  t.updatedAt = now
  if (checkAt !== undefined) t.nextCheckAt = checkAt
  if (evidence) t.evidence.push(evidence)
}

function find(state, raw, owner) {
  if (typeof raw?.id === 'string') {
    const byId = state.threads.find((t) => t.id === raw.id)
    if (byId !== undefined) return byId
  }
  if (!raw?.title) return undefined
  return state.threads
    .filter((t) => t.owner === owner && t.status === 'open')
    .find((t) => similarity(t.title, raw.title) >= 0.5)
}

/** Keep the open set bounded: the stalest open threads close themselves. */
function trim(state) {
  const open = state.threads.filter((t) => t.status === 'open').sort((a, b) => b.updatedAt - a.updatedAt)
  for (const t of open.slice(MAX_OPEN)) {
    t.status = 'closed'
    t.outcome = '很久没再提起'
  }
}

/** The open threads most worth having in mind right now. */
export function activeThreads(state, now, limit = 5, owner) {
  return state.threads
    .filter((t) => t.status === 'open' && (owner === undefined || t.owner === owner))
    .map((t) => ({ t, score: (t.nextCheckAt <= now ? 2 : 0) + 1 / (1 + (now - t.updatedAt) / DAY) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.t)
}

/** User threads due for a check-in that have not been asked about recently. */
export function dueThreads(state, now) {
  return state.threads.filter(
    (t) => t.owner === 'user' && t.status === 'open' && t.nextCheckAt <= now && now - (t.lastAskedAt ?? 0) > 12 * HOUR,
  )
}

/** Nightly upkeep: threads untouched for three weeks are let go. */
export function consolidate(state, now, log) {
  let closed = 0
  for (const t of state.threads) {
    if (t.status === 'open' && now - t.updatedAt > 21 * DAY) {
      t.status = 'closed'
      t.outcome = '很久没再提起'
      closed += 1
    }
  }
  if (closed > 0) log('thread.lapse', { count: closed })
  return closed
}
