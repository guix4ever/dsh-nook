/** Test doubles: a scripted model, a search backend and a delivery sink. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { NookEngine } from '../lib/core/engine.js'

export function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nook-test-'))
}

/** 2026-10-27 14:00 in Shanghai. */
export const AFTERNOON = Date.parse('2026-10-27T06:00:00Z')

export function clock(start = AFTERNOON) {
  let t = start
  return { now: () => t, advance: (ms) => (t += ms), set: (v) => (t = v) }
}

/** A model that answers each background job from simple rules about the text. */
export function scriptedLlm() {
  const calls = []
  const llm = async ({ system, user, purpose }) => {
    calls.push({ purpose, system, user })
    const input = JSON.parse(user)
    if (purpose === 'digest') return JSON.stringify(digest(input))
    if (purpose === 'note') {
      if (!input.results.length) return '{"none":true}'
      return JSON.stringify({ index: 0, title: input.results[0].title, takeaway: '原来第一个月最重要的是让它安心', shareScore: 0.85, why: '对方想养猫', interests: ['猫'] })
    }
    if (purpose === 'decide') return '{"speak":true,"angle":"顺手把文章发过去"}'
    if (purpose === 'day') return JSON.stringify({ title: '聊到了猫', summary: '今天对方说想养猫，后来又说暂时不养了。', feeling: '有点可惜', moments: [] })
    if (purpose === 'growth') return '{"changes":[]}'
    return '{}'
  }
  llm.calls = calls
  return llm
}

function digest(input) {
  const text = input.userSaid
  const cat = input.existingMemories.find((m) => m.text.includes('猫') && m.status === 'active')
  const thread = input.openThreads.find((t) => t.title.includes('猫'))
  if (/不养/.test(text)) {
    return {
      memories: cat ? [{ op: 'invalidate', id: cat.id, reason: '对方说暂时不养了' }, { op: 'add', type: 'event', text: '最近要搬家', source: 'confirmed', area: 'routine', importance: 0.6, keywords: ['搬家'] }] : [],
      threads: thread ? [{ op: 'close', id: thread.id, outcome: '暂时不养了' }] : [],
      appraisal: { kind: 'share', intensity: 0.4, reason: '对方说暂时不养猫了', feeling: '有点可惜' },
      reaction: 0,
      phrases: [],
    }
  }
  if (/养/.test(text) && /猫/.test(text)) {
    return {
      memories: [{ op: 'add', type: 'preference', text: '想养一只猫', source: 'confirmed', area: 'likes', importance: 0.7, emotion: { valence: 0.5, intensity: 0.4 }, keywords: ['养猫', '新手养猫'] }],
      threads: [{ op: 'open', title: '想养猫', stage: '还在考虑', checkInHours: 48 }],
      appraisal: { kind: 'share', intensity: 0.5, reason: '对方跟她说想养猫', feeling: '开心' },
      reaction: null,
      phrases: ['下班回家'],
    }
  }
  return { memories: [], threads: [], appraisal: { kind: 'none' }, reaction: 0, phrases: [] }
}

export function fakeSearch() {
  const queries = []
  let fail = false
  const search = async (query) => {
    queries.push(query)
    if (fail) throw new Error('search provider unavailable')
    return { sources: [{ url: 'https://example.com/new-cat', title: '新手养猫第一个月：哪些必须买，哪些可以等', snippet: '猫砂盆和航空箱是第一天就要有的' }] }
  }
  search.queries = queries
  search.fail = (v = true) => (fail = v)
  return search
}

export function fakeDelivery() {
  const sent = []
  const deliver = async ({ taskId, text }) => {
    sent.push({ taskId, text })
    return { sessionId: 's1', messageId: `m${sent.length}` }
  }
  deliver.sent = sent
  return deliver
}

export function engine(opts = {}) {
  const c = opts.clock ?? clock()
  const e = new NookEngine({
    dir: opts.dir ?? tempDir(),
    llm: opts.llm ?? scriptedLlm(),
    search: opts.search ?? fakeSearch(),
    deliver: opts.deliver ?? fakeDelivery(),
    wasDelivered: opts.wasDelivered,
    now: c.now,
    random: opts.random ?? (() => 0.5),
  })
  return { e, c }
}
