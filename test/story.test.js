/**
 * The acceptance story: the user wants a cat → Nook remembers → reads about it
 * on her own → shares at a good moment → the user changes their mind → pending
 * cat content is withdrawn → the day card records it → the next day she does not
 * keep pushing cats. Plus quiet hours, a failed search, and a restart mid-send.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { engine, clock, fakeDelivery, fakeSearch, scriptedLlm, tempDir, AFTERNOON } from './fakes.js'
import { HOUR, DAY } from '../lib/core/clock.js'
import { candidates } from '../lib/core/outreach.js'

async function born(opts) {
  const { e, c } = engine(opts)
  await e.updateSettings({ timeZone: 'Asia/Shanghai' })
  await e.setup({ name: '小满', relation: 'friend' })
  return { e, c }
}

test('the cat story', async () => {
  const deliver = fakeDelivery()
  const search = fakeSearch()
  const { e, c } = await born({ deliver, search })

  // Day 1, 14:00: the user mentions a cat.
  await e.userMessage('s1', '最近好想养只猫，下班回家有个东西等我')
  e.snapshot('s1', '最近好想养只猫')
  await e.assistantMessage('s1', '那你得先想好是猫等你还是你等猫。')
  const cat = e.state.memories.find((m) => m.text === '想养一只猫')
  assert.equal(cat?.source, 'confirmed', 'remembered as something the user said')
  assert.ok(e.state.threads.some((t) => t.title === '想养猫' && t.status === 'open'), 'opened a thread')

  // 15:00: her own time — she reads about cats, because it is about the user.
  c.advance(HOUR)
  e.state.schedule.explore = c.now()
  await e.explore()
  const note = e.state.notes.at(-1)
  assert.equal(note.status, 'ok')
  assert.deepEqual(note.about, [cat.id], 'the note is tied to the cat memory')
  assert.ok(e.state.memories.some((m) => m.source === 'self' && m.text.includes('新手养猫')), 'her own experience is recorded as hers')

  // 15:40: a good moment — she shares it.
  c.advance(40 * 60_000)
  await e.reachOut()
  assert.equal(deliver.sent.length, 1)
  assert.match(deliver.sent[0].text, /新手养猫第一个月/)

  // She read a second article that is not shared yet.
  c.advance(HOUR)
  e.state.schedule.explore = c.now()
  e.state.notes.at(-1).at -= 3 * DAY // let the topic rest period pass
  await e.explore()
  const second = e.state.notes.at(-1)
  assert.equal(second.status, 'ok')
  assert.equal(second.shared, false)

  // 18:22: the user changes their mind.
  c.advance(HOUR)
  await e.userMessage('s1', '算了，最近要搬家，暂时不养了')
  await e.assistantMessage('s1', '好，那我先不惦记这事了。搬到哪儿？')
  assert.equal(e.state.memories.find((m) => m.id === cat.id).status, 'invalid', '"想养猫" no longer holds')
  assert.equal(e.state.notes.find((n) => n.id === second.id).status, 'withdrawn', 'the unshared cat article is withdrawn')
  assert.ok(e.state.threads.some((t) => t.title === '想养猫' && t.status === 'closed'))
  assert.equal(e.state.mood.label, '有点可惜')
  assert.ok(!candidates(e.state, c.now()).some((x) => x.kind === 'note'), 'nothing about cats is left to send')

  // That night: the day card, built from what happened.
  c.set(Date.parse('2026-10-27T16:40:00Z')) // 00:40 next day in Shanghai, after her bedtime
  await e.consolidate()
  assert.equal(e.state.days.at(-1).title, '聊到了猫')

  // Next afternoon: cats are not a topic any more.
  c.set(Date.parse('2026-10-28T06:00:00Z'))
  const before = search.queries.length
  e.state.schedule.explore = c.now()
  await e.explore()
  assert.ok(search.queries.slice(before).every((q) => !q.includes('猫')), 'does not go looking for cat guides again')
  const snapshot = e.snapshot('s1', '在吗')
  assert.doesNotMatch(snapshot, /想养一只猫/, 'the old intention is not presented as current')
})

test('no outreach during her sleep hours', async () => {
  const deliver = fakeDelivery()
  const { e, c } = await born({ deliver })
  await e.userMessage('s1', '最近好想养只猫')
  await e.assistantMessage('s1', '好呀')
  c.advance(HOUR)
  e.state.schedule.explore = c.now()
  await e.explore()
  // 02:00 in Shanghai.
  c.set(Date.parse('2026-10-27T18:00:00Z'))
  await e.reachOut()
  assert.equal(deliver.sent.length, 0)
  // 10:00 the next morning she may.
  c.set(Date.parse('2026-10-28T02:00:00Z'))
  await e.reachOut()
  assert.equal(deliver.sent.length, 1)
})

test('a failed search is recorded as a failure, not an experience', async () => {
  const search = fakeSearch()
  search.fail()
  const llm = scriptedLlm()
  const { e, c } = await born({ search, llm })
  await e.userMessage('s1', '最近好想养只猫')
  await e.assistantMessage('s1', '好呀')
  c.advance(HOUR)
  e.state.schedule.explore = c.now()
  await e.explore()
  const note = e.state.notes.at(-1)
  assert.equal(note.status, 'failed')
  assert.ok(!e.state.memories.some((m) => m.source === 'self'), 'no "I read…" memory')
  assert.ok(!llm.calls.some((x) => x.purpose === 'note'), 'nothing is written without sources')
  assert.match(e.snapshot('s1', '你今天干嘛了'), /没搜到靠谱的内容/)
  assert.equal(candidates(e.state, c.now()).filter((x) => x.kind === 'note').length, 0)
})

test('a restart in the middle of sending does not send twice', async () => {
  const dir = tempDir()
  const c = clock()
  const delivered = new Set()
  let crash = true
  const deliver = async ({ taskId }) => {
    delivered.add(taskId)
    if (crash) throw new Error('process killed after the session stored the message')
    return { sessionId: 's1', messageId: 'm1' }
  }
  const first = await born({ dir, clock: c, deliver })
  await first.e.userMessage('s1', '最近好想养只猫')
  await first.e.assistantMessage('s1', '好呀')
  c.advance(HOUR)
  first.e.state.schedule.explore = c.now()
  await first.e.explore()
  c.advance(HOUR)
  await assert.rejects(first.e.reachOut())
  assert.equal(first.e.state.outreach.tasks.at(-1).status, 'delivering')

  crash = false
  let second = 0
  const again = engine({
    dir,
    clock: c,
    deliver: async (x) => {
      second += 1
      return deliver(x)
    },
    wasDelivered: async (id) => delivered.has(id),
  })
  await again.e.tick()
  assert.equal(second, 0, 'the message already in the session is not sent again')
  assert.equal(again.e.state.outreach.tasks.at(-1).status, 'delivered')
})
