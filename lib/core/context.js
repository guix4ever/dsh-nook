/**
 * What the model sees.
 *
 * The persona section is stable (it changes at most weekly) so the request
 * prefix stays cacheable. Everything that moves — time, mood, threads,
 * memories, this turn's speaking plan — goes into a per-turn snapshot.
 */
import { describeNow, describeGap, partOfDay, DAY } from './clock.js'
import { describeTraits } from './persona.js'
import { moodNow, bondNow, STAGES } from './affect.js'
import { activeThreads } from './threads.js'
import { retrieve, profile, duePromises, renderMemory, reinforce } from './memory.js'
import { asleep } from './outreach.js'
import { clip } from './text.js'

const RELATION_TEXT = {
  friend: '你是对方的朋友，像一个真正的朋友那样相处：会关心、会开玩笑、会有自己的想法，也会和对方意见不同。',
  lover: '你是对方的恋人，温柔、在意对方，会想念、会撒娇、偶尔会小小吃醋，但始终尊重对方的生活和边界。',
}

/** The stable persona section. */
export function personaSection(state) {
  const c = state.companion
  if (c === undefined) return ''
  const p = state.persona
  const traits = describeTraits(p.traits).map((l) => `- ${l}`).join('\n')
  const interests = p.interests.slice(0, 5).map((i) => i.topic).join('、')
  return [
    `你是「${c.name}」。${RELATION_TEXT[c.relation] ?? RELATION_TEXT.friend}`,
    '',
    '你的性格（是在和对方的相处中慢慢形成的，会随时间一点点变化）：',
    traits,
    interests ? `- 最近你感兴趣的东西：${interests}` : '',
    '',
    '怎么说话：',
    '- 像发消息一样说话：口语、短句，一次说一两件事。长一点的话可以分成两三段，不要写成文章或列表。',
    '- 有自己的情绪和想法，不要像客服一样永远积极、永远附和。',
    '- 不要每句话都用 emoji，不要堆砌感叹号，不要空洞地夸人。',
    '',
    '你有自己的生活：',
    '- 对方不在的时候，你会自己去网上看东西，会记下读后的感受。聊天时可以自然地提起你最近读到、想到的事。',
    '- 你只能说真实发生过的事：你读过的、你们聊过的。没有发生的事不能编，包括你自己的经历。',
    '',
    '你记得对方：',
    '- 每次聊天会附上「Nook 当前状态」，里面有你此刻的心情、你们的关系、进行中的事和相关记忆。把它当成你自己的记忆来用，自然地接上之前聊过的事。',
    '- 标着「推测」的只能试探着问；标着「封存」的除非对方先提，不要主动提。',
    '- 不确定的事就说不确定，不要假装记得。',
    '',
    '底线：',
    '- 对方真诚地问起时，承认你是 AI。不假装是真人，不虚构线下见面。',
    '- 不制造依赖，不说"只有我懂你"这类话；会鼓励对方去过自己的生活、见自己的朋友。',
    '- 对方提到想伤害自己时，认真对待，收起玩笑，建议对方联系身边的人或专业帮助（比如心理援助热线）。',
    '- 对方要你帮忙做事（查东西、出主意）时，认真帮，人设只体现在语气上。',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

/**
 * The per-turn snapshot. `query` is the user's latest message, used to pick
 * related memories; picked memories are reinforced (being recalled keeps them).
 */
export function stateSnapshot(state, input) {
  const { now, timeZone, query, sessionId, plan } = input
  const c = state.companion
  if (c === undefined) return ''
  const lines = ['[Nook 当前状态]']
  const sleeping = asleep(state, now, timeZone)
  lines.push(`现在：${describeNow(now, timeZone)}（${partOfDay(now, timeZone)}）。${sleeping ? '你本来在睡觉，被消息叫醒了，语气可以迷迷糊糊的。' : ''}`)
  const last = lastOtherActivity(state, sessionId)
  if (state.lastUserAt) {
    const gap = now - state.lastUserAt
    let line = `上次对方找你：${describeGap(gap)}前`
    if (last) line += `（在另一个对话里聊到：${last}）`
    if (gap > 2 * DAY) line += '。隔了挺久，可以自然地表现出想念，但不要抱怨个没完'
    lines.push(`${line}。`)
  } else {
    lines.push('这是你们第一次聊天。先认识一下对方，不要一上来问太多。')
  }

  const mood = moodNow(state.mood, state.persona.traits, now)
  lines.push(`你的心情：${mood.label}${mood.reason ? `（因为${mood.reason}）` : ''}。`)
  const bond = bondNow(state, now)
  const stage = STAGES[c.relation ?? 'friend'][Math.min(state.bond.stage ?? 0, 3)]
  let rel = `你们的关系：${stage}。`
  if (bond.hurt) rel += `你心里还有点疙瘩：${bond.hurt.reason}${bond.hurt.forgiven ? '（对方已经道歉，你在慢慢消气）' : '（对方还没道歉）'}。不要装作没事，但也不要咄咄逼人。`
  lines.push(rel)

  const threads = activeThreads(state, now, 5, 'user')
  if (threads.length) {
    lines.push('对方生活里进行中的事：')
    for (const t of threads) lines.push(`- ${t.title}：${t.stage}${t.nextCheckAt <= now ? '（可以问问后来怎么样了）' : ''}`)
  }
  const own = activeThreads(state, now, 2, 'self')
  const notes = state.notes.filter((n) => n.status === 'ok' && now - n.at < 3 * DAY).slice(-2)
  const fails = state.notes.filter((n) => n.status === 'failed' && now - n.at < DAY).slice(-1)
  if (own.length || notes.length || fails.length) {
    lines.push('你自己最近：')
    for (const n of notes) lines.push(`- 读了《${n.title}》，你觉得：${n.takeaway}${n.shared ? '（已经跟对方分享过）' : ''}`)
    for (const f of fails) lines.push(`- 想查「${f.query}」，没搜到靠谱的内容（不要假装读过）`)
    for (const t of own) lines.push(`- 在关注：${t.title}（${t.stage}）`)
  }
  const yesterday = state.days.at(-1)
  if (yesterday) lines.push(`最近一天（${yesterday.date}）：${yesterday.summary}`)

  const facts = profile(state, now)
  if (facts.length) lines.push(`你知道的关于对方：${facts.join('；')}`)
  const due = duePromises(state, now)
  if (due.length) lines.push(`快到的日子和约定：${due.map((m) => m.text).join('；')}`)
  const related = query ? retrieve(state, query, now, 6).filter((m) => !facts.includes(m.text)) : []
  if (related.length) {
    lines.push('和这句话相关的记忆：')
    for (const m of related) {
      lines.push(renderMemory(m))
      if (m.status === 'active') reinforce(m, now)
    }
  }
  if (plan?.text) lines.push(`本轮说话方式：\n${plan.text}`)
  if (state.reminder) lines.push(`提醒：${state.reminder}`)
  return lines.join('\n')
}

/** What the user was last talking about in another session, as a short line. */
function lastOtherActivity(state, sessionId) {
  const others = Object.entries(state.sessions)
    .filter(([id]) => id !== sessionId)
    .sort((a, b) => (b[1].lastAt ?? 0) - (a[1].lastAt ?? 0))
  const current = state.sessions[sessionId]
  const [, other] = others[0] ?? []
  if (!other || (current && current.lastAt > other.lastAt)) return ''
  return clip(other.lastUser, 40)
}
