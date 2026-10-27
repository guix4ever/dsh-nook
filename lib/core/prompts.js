/**
 * Prompts for the background model calls, and tolerant JSON parsing of their
 * answers. Every job asks for one JSON object; an unreadable answer changes
 * nothing rather than guessing.
 */
import { describeNow } from './clock.js'
import { MEMORY_TYPES } from './memory.js'
import { KNOW_AREAS } from './state.js'
import { APPRAISALS } from './affect.js'

/** First JSON object in a model reply, or undefined. */
export function parseJson(raw) {
  const text = String(raw ?? '').trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return undefined
  }
}

const list = (o) => Object.entries(o).map(([k, v]) => `${k}=${v}`).join('；')

/**
 * After each exchange: what to remember, which threads moved, how the message
 * made her feel, and how the user took her previous reply.
 */
export function digestPrompt(input) {
  const system = [
    `你在帮一个叫「${input.name}」的 AI 伙伴整理她和对方（用户）刚才的对话。只输出一个 JSON 对象，不要解释。`,
    '',
    '规则：',
    '1. 只记对方明确说出的事，标 source="confirmed"；从语气推断出来的才标 "inferred"，推断要克制。',
    '2. 和已有记忆说的是同一件事时，用 update/invalidate 并带上它的 id，不要重复 add。对方改变了主意（比如说"不养猫了"），把旧记忆 invalidate。',
    '3. 对方说"别提了/不想聊这个"，用 seal。对方说"这个别记"，不要记。',
    '4. 有"后来呢"的事（面试、搬家、生病、吵架、考试……）开一个 thread；有进展用 update；结束了用 close。checkInHours 是过多久值得再关心一下。',
    '5. 带具体日期的约定或重要日子记成 type="promise"，dueAt 用 ISO 时间（按对方时区）。',
    '6. appraisal 是这条消息对她的意义，kind 只能取：' + Object.keys(APPRAISALS).filter((k) => k !== 'neglect' && k !== 'reunion').join('/') + '/none。feeling 是她此刻的心情，用两到四个字，比如"有点可惜""开心""委屈"。',
    '7. reaction 是对方对她上一条回复的反应：-1 冷淡/反感，0 一般，1 很受用；没有上一条就填 null。',
    '8. phrases 是对方说话里有个人特色、她可能会学着用的短语（2-8 字），没有就空数组。',
    '',
    `type 取值：${list(MEMORY_TYPES)}`,
    `area 取值：${list(KNOW_AREAS)}`,
    '',
    '输出格式：',
    '{"memories":[{"op":"add|update|invalidate|seal|done","id":"已有记忆的 id（update/invalidate/seal/done 必填）","type":"...","text":"一句话","source":"confirmed|inferred","area":"...","importance":0.5,"emotion":{"valence":0,"intensity":0},"keywords":["..."],"dueAt":"ISO 可选","reason":"为什么改"}],',
    ' "threads":[{"op":"open|update|close","id":"已有 thread 的 id（update/close 必填）","title":"四到十个字","stage":"现在进行到哪","checkInHours":24,"outcome":"close 时的结果"}],',
    ' "appraisal":{"kind":"...","intensity":0.5,"reason":"一句话","feeling":"..."},',
    ' "reaction":null,',
    ' "phrases":[]}',
  ].join('\n')
  const user = JSON.stringify({
    now: describeNow(input.now, input.timeZone),
    timeZone: input.timeZone,
    existingMemories: input.memories.map((m) => ({ id: m.id, type: m.type, text: m.text, source: m.source, status: m.status })),
    openThreads: input.threads.map((t) => ({ id: t.id, title: t.title, stage: t.stage })),
    herPreviousReply: input.previousReply ?? null,
    userSaid: input.userText,
    herReply: input.reply ?? null,
  })
  return { system, user }
}

/** Turn search results into her note, using only the given sources. */
export function notePrompt(input) {
  const system = [
    `你是「${input.name}」，一个有自己生活的 AI 伙伴。你刚才自己去查了「${input.query}」。`,
    '下面是真实的搜索结果。只能从这些结果里挑一篇来写，不能编造没有出现的文章、链接或内容。如果都不相关或没有实质内容，输出 {"none":true}。',
    '否则输出一个 JSON：{"index":结果编号,"title":"标题","takeaway":"你读完的感受或看法，一两句，用你自己的口吻","shareScore":0到1,"why":"为什么对方可能会感兴趣（没有就留空）","interests":["这篇让你更感兴趣的话题，最多两个"]}',
    `shareScore 看这篇和对方的关系：${input.aboutUser ? '这是和对方有关的事，' : ''}对方最近关心的事、对方会喜欢的才给高分。`,
  ].join('\n')
  const user = JSON.stringify({
    yourInterests: input.interests,
    aboutUser: input.aboutUser ?? null,
    results: input.sources.map((s, i) => ({ index: i, title: s.title ?? '', url: s.url, snippet: s.snippet ?? '' })),
    providerSummary: input.content ? String(input.content).slice(0, 1500) : null,
  })
  return { system, user }
}

/** Does she want to reach out about this, now? */
export function decidePrompt(input) {
  const system = [
    `你是「${input.name}」。${input.persona}`,
    '现在没有人在跟你聊天。你在想要不要主动给对方发条消息。',
    '想发就输出 {"speak":true,"angle":"打算怎么开口，一句话"}；觉得现在没必要、会打扰、或者没什么好说的，就输出 {"speak":false}。宁可不发，也不要发客服式的推送。',
  ].join('\n')
  const user = JSON.stringify({ now: input.now, mood: input.mood, relation: input.relation, reason: input.brief, recentChat: input.recent })
  return { system, user }
}

/** The day's timeline card, from that day's events only. */
export function dayCardPrompt(input) {
  const system = [
    `你是「${input.name}」。根据今天真实发生的事件，写今天的时间线卡片。只能写事件里有的事，不能补充或想象。`,
    '输出 JSON：{"title":"今天的标题，十个字以内","summary":"今天发生了什么，两三句，用第一人称（我）写","feeling":"你今天的一句感受","moments":["值得作为你们共同回忆的事，没有就空数组"]}',
  ].join('\n')
  const user = JSON.stringify({ date: input.date, events: input.events })
  return { system, user }
}

/** Weekly growth: small, evidence-backed trait changes. */
export function growthPrompt(input) {
  const system = [
    `你在帮 AI 伙伴「${input.name}」做每周回顾。她的性格用五个维度表示（0 到 1）：E 外向，A 宜人，C 尽责，N 情绪敏感，O 开放。`,
    '根据这一周她和对方之间真实发生的事，判断她的性格有没有被这段关系慢慢改变。改变要小（每项不超过 ±0.03），必须能指出是哪些事导致的；没有足够证据就不要改。',
    '输出 JSON：{"changes":[{"trait":"E|A|C|N|O","delta":0.02,"because":"引用具体的事","note":"她自己的一句话，比如这周好像没那么怕你不回消息了"}]}，没有变化就输出 {"changes":[]}。',
  ].join('\n')
  const user = JSON.stringify({ traits: input.traits, days: input.days, reactions: input.reactions })
  return { system, user }
}
