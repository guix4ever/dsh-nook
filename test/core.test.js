/** Unit checks for the pieces the story test does not pin down. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { initialState } from '../lib/core/state.js'
import { applyMemoryOps, retrieve, strengthOf, sealTopic } from '../lib/core/memory.js'
import { seedPersona, chooseStrategy, applyGrowth, undoGrowth, situationOf } from '../lib/core/persona.js'
import { appraise, bondNow, settleStage } from '../lib/core/affect.js'
import { claimsReading } from '../lib/core/engine.js'
import { topicPool } from '../lib/core/explore.js'
import { DAY } from '../lib/core/clock.js'

const noLog = () => ({ id: 'ev' })

function fresh() {
  const s = initialState()
  s.companion = { name: '小满', relation: 'friend' }
  s.persona = seedPersona('ENFP', () => 0.5)
  return s
}

test('a repeated memory reinforces instead of duplicating, and a guess can be confirmed', () => {
  const s = fresh()
  applyMemoryOps(s, [{ op: 'add', type: 'preference', text: '喜欢喝抹茶', source: 'inferred' }], 0, 'e1', noLog)
  applyMemoryOps(s, [{ op: 'add', type: 'preference', text: '喜欢喝抹茶拿铁', source: 'confirmed' }], 10, 'e2', noLog)
  assert.equal(s.memories.length, 1)
  assert.equal(s.memories[0].source, 'confirmed')
})

test('an update keeps what it used to be', () => {
  const s = fresh()
  const [m] = applyMemoryOps(s, [{ op: 'add', type: 'preference', text: '每天一杯冰美式', source: 'confirmed' }], 0, 'e1', noLog)
  applyMemoryOps(s, [{ op: 'update', id: m.id, text: '最近改喝茶了', reason: '咖啡喝多了心慌' }], 1, 'e2', noLog)
  assert.equal(s.memories[0].text, '最近改喝茶了')
  assert.equal(s.memories[0].history[0].text, '每天一杯冰美式')
})

test('guesses fade faster than things the user said', () => {
  const said = { status: 'active', source: 'confirmed', importance: 0.5, emotion: { intensity: 0 }, createdAt: 0 }
  const guess = { ...said, source: 'inferred' }
  assert.ok(strengthOf(guess, 20 * DAY) < strengthOf(said, 20 * DAY))
})

test('a sealed topic is not brought up and not re-learned', () => {
  const s = fresh()
  applyMemoryOps(s, [{ op: 'add', type: 'event', text: '和前男友分手了', source: 'confirmed' }], 0, 'e1', noLog)
  sealTopic(s, '和前男友分手', 1, noLog)
  assert.equal(retrieve(s, '周末去哪玩', 2).length, 0)
  applyMemoryOps(s, [{ op: 'add', type: 'event', text: '和前男友分手后很难过', source: 'confirmed' }], 3, 'e2', noLog)
  assert.ok(!s.memories.some((m) => m.status === 'active' && m.text.includes('前男友')))
})

test('strong situations override personality', () => {
  const p = seedPersona('ENFP', () => 0.5)
  assert.equal(situationOf('这个怎么弄？'), 'request')
  assert.equal(chooseStrategy(p, '这个怎么弄？'), undefined)
  assert.equal(chooseStrategy(p, '我不想活了'), undefined)
  assert.ok(chooseStrategy(p, '今天好累', () => 0.3))
})

test('she does not pick "share my news" when she has none', () => {
  const p = seedPersona('ENFP', () => 0.5)
  p.prefs.share = 1
  for (const r of [0.05, 0.3, 0.6, 0.95]) assert.notEqual(chooseStrategy(p, '今天好累', () => r, 0.35, { canShare: false }), 'share')
})

test('growth is capped, recorded, and can be undone', () => {
  const p = seedPersona(undefined, () => 0.5)
  const before = p.traits.N
  applyGrowth(p, [{ trait: 'N', delta: -0.5, because: '几次没回消息后来都是在忙' }], 1)
  assert.ok(Math.abs(p.traits.N - before) <= 0.03 + 1e-9)
  assert.ok(undoGrowth(p, p.growth[0].id))
  assert.equal(p.traits.N, before)
  assert.equal(applyGrowth(p, [{ trait: 'N', delta: 0.02 }], 2).length, 0, 'a change needs a reason')
})

test('an apology eases a grudge and the stage never drops', () => {
  const s = fresh()
  s.bond.intimacy = 50
  settleStage(s, 0, noLog)
  const stage = s.bond.stage
  appraise(s, 'insult', 1, '被说人工智障', 0, noLog)
  const hurt = bondNow(s, 1).grudge
  appraise(s, 'apology', 1, '对方道歉了', 2, noLog)
  assert.ok(bondNow(s, 3).grudge < hurt)
  settleStage(s, 4, noLog)
  assert.equal(s.bond.stage, stage)
})

test('claims of having read something are caught', () => {
  assert.ok(claimsReading('我前几天刚好刷到一篇讲上海租房养宠物的'))
  assert.ok(claimsReading('我看到一篇文章说'))
  assert.equal(claimsReading('你看到了吗'), '')
})

test('facts about the user are never search topics', () => {
  const s = fresh()
  s.persona.interests = []
  applyMemoryOps(s, [{ op: 'add', type: 'fact', text: '叫阿鹿，在上海做设计', source: 'confirmed', importance: 0.9 }], 0, 'e1', noLog)
  applyMemoryOps(s, [{ op: 'add', type: 'preference', text: '喜欢看展', source: 'confirmed', importance: 0.7, keywords: ['看展'] }], 0, 'e2', noLog)
  const topics = topicPool(s, 1).map((t) => t.topic)
  assert.ok(!topics.some((t) => t.includes('阿鹿')))
  assert.ok(topics.some((t) => t.includes('看展')))
})
