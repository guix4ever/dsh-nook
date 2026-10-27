/**
 * Small text helpers for matching memories without an embedding model.
 *
 * Chinese has no spaces, so text is split into character bigrams; Latin words and
 * numbers stay whole. That is enough to tell whether a memory is about the same
 * thing as the current message at the sizes Nook deals with (hundreds of items).
 */

const LATIN = /[a-z0-9]+/g
const CJK = /[㐀-鿿豈-﫿]+/g

/** Lower-cased tokens: whole Latin words plus CJK character bigrams (single characters for one-character runs). */
export function tokens(text) {
  const source = String(text ?? '').toLowerCase()
  const out = []
  for (const word of source.match(LATIN) ?? []) out.push(word)
  for (const run of source.match(CJK) ?? []) {
    if (run.length === 1) out.push(run)
    for (let i = 0; i + 1 < run.length; i += 1) out.push(run.slice(i, i + 2))
  }
  return out
}

/** Set of distinct tokens. */
export function tokenSet(text) {
  return new Set(tokens(text))
}

/**
 * Share of the query's tokens found in the candidate, 0–1. Asymmetric on purpose:
 * a short message that names a topic should match a long memory about it.
 */
export function overlap(query, candidate) {
  const q = query instanceof Set ? query : tokenSet(query)
  const c = candidate instanceof Set ? candidate : tokenSet(candidate)
  if (q.size === 0 || c.size === 0) return 0
  let hit = 0
  for (const t of q) if (c.has(t)) hit += 1
  return hit / q.size
}

/** Symmetric similarity, used to spot duplicate memories. */
export function similarity(a, b) {
  const x = a instanceof Set ? a : tokenSet(a)
  const y = b instanceof Set ? b : tokenSet(b)
  if (x.size === 0 || y.size === 0) return 0
  let hit = 0
  for (const t of x) if (y.has(t)) hit += 1
  return hit / Math.min(x.size, y.size)
}

/** Trim and cut text to `max` characters, adding an ellipsis when cut. */
export function clip(text, max) {
  const value = String(text ?? '').trim()
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`
}
