/**
 * Durable storage for one companion: an append-only event log plus a state file.
 *
 * The event log (`events.jsonl`) is the record of everything that happened — what
 * the user said, what Nook did, every memory change — and is never rewritten.
 * Memories, mood, threads and the rest live in `state.json`, which is replaced
 * atomically (write to a temp file, then rename) so a crash leaves either the old
 * or the new state, never half of one.
 *
 * All writes go through one queue, so concurrent sessions cannot interleave a
 * read-modify-write.
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'

/** `<DSH_HOME>/storages/dsh-nook`, the same convention other plugins use. */
export function defaultDir() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(home, 'storages', 'dsh-nook')
}

/** Short, sortable id with a kind prefix, e.g. `mem_lq3k2…`. */
export function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${randomUUID().slice(0, 8)}`
}

export class FileStore {
  /**
   * @param dir - directory owned by this companion.
   * @param initial - factory for the state used when no state file exists yet.
   */
  constructor(dir, initial) {
    this.dir = dir
    this.initial = initial
    this.statePath = path.join(dir, 'state.json')
    this.eventsPath = path.join(dir, 'events.jsonl')
    this.queue = Promise.resolve()
    this.state = undefined
  }

  /** Load state from disk (or create it). Safe to call more than once. */
  load() {
    if (this.state !== undefined) return this.state
    fs.mkdirSync(this.dir, { recursive: true })
    try {
      this.state = JSON.parse(fs.readFileSync(this.statePath, 'utf8'))
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        // Keep the unreadable file for inspection instead of silently losing it.
        try {
          fs.renameSync(this.statePath, `${this.statePath}.broken-${Date.now()}`)
        } catch {}
      }
      this.state = this.initial()
      this.writeStateSync()
    }
    return this.state
  }

  writeStateSync() {
    const tmp = `${this.statePath}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 1))
    fs.renameSync(tmp, this.statePath)
  }

  /**
   * Run `fn(state, log)` under the write lock, then persist. `log(kind, data)`
   * appends events that are written before the state, so the state never refers
   * to an event that is not on disk.
   * @returns whatever `fn` returns.
   */
  transact(fn) {
    const run = this.queue.then(async () => {
      const state = this.load()
      const pending = []
      const log = (kind, data = {}, extra = {}) => {
        const event = { id: newId('ev'), at: extra.at ?? Date.now(), kind, ...(extra.sessionId ? { sessionId: extra.sessionId } : {}), data }
        pending.push(event)
        return event
      }
      const result = await fn(state, log)
      if (pending.length > 0) {
        await fsp.appendFile(this.eventsPath, pending.map((e) => JSON.stringify(e)).join('\n') + '\n')
      }
      this.writeStateSync()
      return result
    })
    // Keep the queue alive after a failed transaction.
    this.queue = run.catch(() => undefined)
    return run
  }

  /** Current state without taking the lock; callers must not mutate it. */
  read() {
    return this.load()
  }

  /**
   * Events matching `filter`, oldest first. The log is read from disk each time;
   * it stays small (a few MB a year) at Nook's volume.
   */
  async events(filter = () => true) {
    let text
    try {
      text = await fsp.readFile(this.eventsPath, 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') return []
      throw error
    }
    const out = []
    for (const line of text.split('\n')) {
      if (line.length === 0) continue
      try {
        const event = JSON.parse(line)
        if (filter(event)) out.push(event)
      } catch {
        // A torn last line after a crash is skipped, not fatal.
      }
    }
    return out
  }
}
