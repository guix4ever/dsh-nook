/**
 * Shared between the host plugin and the per-agent plugin of the same package:
 * the engine, which sessions belong to Nook, and the model route they use.
 */

import { randomUUID } from 'node:crypto'

export const NOTICE_KIND = 'dsh-nook'

/**
 * A user-role message, shaped like dsh-llm's createUserMessage. Built here so
 * the plugin does not need to resolve dsh's own packages from its install path.
 */
export function userMessage(content, source) {
  return Object.freeze({ id: randomUUID(), role: 'user', content: Object.freeze(content), source: Object.freeze(source) })
}

export const runtime = {
  /** @type {import('./core/engine.js').NookEngine | undefined} */
  engine: undefined,
  /** Session ids of live Nook agents. */
  nookSessions: new Set(),
  /** Provider route of the most recent Nook agent, reused for background calls. */
  route: undefined,
}

/** Plain text of a message's text blocks. */
export function textOf(message) {
  return (message?.content ?? [])
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
}
