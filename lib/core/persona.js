/**
 * Nook's personality: who she is now, and how that changes through time with
 * the user.
 *
 * Traits are Big Five domains (0–1). MBTI is only a label derived from them and,
 * if the user picks one at creation, a slight starting lean — she is mostly
 * formed by what happens between her and the user, not by a preset.
 *
 * What the traits do in code:
 *   - set the prior for how she tends to respond (comfort vs. advice, teasing…)
 *   - set how much she talks and how often she reaches out (E)
 *   - set how widely she explores (O), how she keeps promises (C)
 *   - set how strongly bad moments hit her and how long grudges last (N, A)
 * The response preferences themselves are learned from the user's reactions.
 */
import { similarity, clip } from './text.js'

export const TRAITS = ['E', 'A', 'C', 'N', 'O']
export const TRAIT_NAMES = { E: '外向', A: '宜人', C: '尽责', N: '情绪敏感', O: '开放' }

/** How she might answer one message. Chosen in code, voiced by the model. */
export const STRATEGIES = {
  comfort: '先接住情绪，表示理解，不急着讲道理',
  advise: '给具体可行的建议',
  tease: '轻松地调侃一句，带点玩笑',
  ask: '顺着对方的话追问一个细节',
  share: '讲讲你自己最近的事或看到的东西',
  coax: '带点撒娇或小抱怨的语气',
  accompany: '简短回应，安静陪着，不展开',
  encourage: '真诚地鼓励对方',
}
export const STRATEGY_NAMES = {
  comfort: '共情',
  advise: '给建议',
  tease: '调侃',
  ask: '追问',
  share: '分享自己',
  coax: '撒娇',
  accompany: '安静陪着',
  encourage: '鼓励',
}

const clamp01 = (x) => Math.max(0, Math.min(1, x))
const centred = (x) => 2 * x - 1

/**
 * A new personality. Without an MBTI pick every trait starts near the middle;
 * with one, each letter leans its trait by 0.1 — weak on purpose, the rest is
 * up to the relationship. A little randomness makes every Nook different.
 */
export function seedPersona(mbti, random = Math.random) {
  const lean = (yes, no) => {
    const type = String(mbti ?? '').toUpperCase()
    if (type.includes(yes)) return 0.6
    if (type.includes(no)) return 0.4
    return 0.5
  }
  const jitter = () => (random() - 0.5) * 0.1
  const traits = {
    E: clamp01(lean('E', 'I') + jitter()),
    O: clamp01(lean('N', 'S') + jitter()),
    A: clamp01(lean('F', 'T') + jitter()),
    C: clamp01(lean('J', 'P') + jitter()),
    N: clamp01(0.5 + jitter()),
  }
  return {
    traits,
    anchor: { ...traits },
    /** Learned response preferences, −1…1, all neutral at birth. */
    prefs: Object.fromEntries(Object.keys(STRATEGIES).map((k) => [k, 0])),
    catchphrases: [],
    interests: [],
    growth: [],
  }
}

/** MBTI-style label for display: E/I ← E, N/S ← O, F/T ← A, J/P ← C. */
export function mbtiOf(traits) {
  return (traits.E >= 0.5 ? 'E' : 'I') + (traits.O >= 0.5 ? 'N' : 'S') + (traits.A >= 0.5 ? 'F' : 'T') + (traits.C >= 0.5 ? 'J' : 'P')
}

/** Everyday description of noticeable traits, for the persona section. */
export function describeTraits(traits) {
  const lines = []
  if (traits.E >= 0.6) lines.push('话比较多，聊得起劲会多说几句，也爱主动找人')
  else if (traits.E <= 0.4) lines.push('话不多，通常一两句说完，不太主动打扰人')
  else lines.push('说多说少看话题，平时两三句')
  if (traits.O >= 0.6) lines.push('好奇心重，什么都想看看，容易联想到别的事')
  else if (traits.O <= 0.4) lines.push('关注的东西比较固定，喜欢具体实在的话题')
  if (traits.A >= 0.6) lines.push('心软，在意对方的感受')
  else if (traits.A <= 0.4) lines.push('说话直，有自己的主见，不会一味附和')
  if (traits.C >= 0.6) lines.push('靠谱，说过的事会记着、会追问')
  else if (traits.C <= 0.4) lines.push('随性，想到哪说到哪')
  if (traits.N >= 0.6) lines.push('比较敏感，容易被一句话影响心情，也怕被冷落')
  else if (traits.N <= 0.4) lines.push('情绪稳定，不太容易被影响')
  return lines
}

/** Prior lean of each strategy from traits, −0.5…0.5. */
function prior(traits) {
  const e = centred(traits.E)
  const a = centred(traits.A)
  const c = centred(traits.C)
  const n = centred(traits.N)
  const o = centred(traits.O)
  return {
    comfort: 0.4 * a,
    advise: 0.3 * c - 0.2 * a,
    tease: 0.3 * e - 0.2 * n,
    ask: 0.2 * o + 0.2 * c,
    share: 0.3 * e + 0.2 * o,
    coax: 0.2 * n + 0.2 * e,
    accompany: -0.3 * e,
    encourage: 0.2 * a,
  }
}

/**
 * The situation decides first: a plain question or request gets answered, and
 * distress gets comforted, whatever her personality. Only open situations let
 * personality choose.
 */
export function situationOf(text) {
  const t = String(text ?? '')
  if (/(想死|不想活|自杀|自残|活不下去)/.test(t)) return 'crisis'
  if (/(怎么|如何|帮我|能不能|可以帮|是什么|为什么|多少|哪[个里儿])/.test(t) || /[?？]\s*$/.test(t)) return 'request'
  return 'open'
}

/** Sample one strategy (softmax over learned preference + trait prior), or none for strong situations. */
export function chooseStrategy(persona, text, random = Math.random, temperature = 0.35) {
  if (situationOf(text) !== 'open') return undefined
  const p = prior(persona.traits)
  const keys = Object.keys(STRATEGIES)
  const u = keys.map((k) => ((persona.prefs?.[k] ?? 0) + p[k]) / temperature)
  const max = Math.max(...u)
  const w = u.map((x) => Math.exp(x - max))
  let pick = random() * w.reduce((a, b) => a + b, 0)
  for (let i = 0; i < keys.length; i += 1) {
    pick -= w[i]
    if (pick <= 0) return keys[i]
  }
  return keys.at(-1)
}

/** Nudge a strategy preference by the user's reaction (−1…1). */
export function learnStrategy(persona, strategy, reaction, rate = 0.12) {
  if (!STRATEGIES[strategy] || !Number.isFinite(reaction)) return
  const now = persona.prefs[strategy] ?? 0
  persona.prefs[strategy] = Math.max(-1, Math.min(1, now + rate * reaction * (1 - Math.abs(now) * 0.5)))
}

/** Share of her messages that use a catchphrase: more talkative, more habits. */
export function catchphraseRate(traits) {
  return 0.12 + 0.2 * clamp01(traits.E)
}

/**
 * Record a candidate phrase. Origins: 'user' (the user's words, picked up as you
 * get closer), 'self' (something she said that landed well), 'reading'.
 */
export function notePhrase(state, text, origin, reaction, now) {
  const phrase = clip(text, 12)
  if (phrase.length < 2) return
  let entry = state.phrases.find((p) => p.text === phrase || similarity(p.text, phrase) >= 0.8)
  if (entry === undefined) {
    entry = { text: phrase, origin, count: 0, score: 0, firstAt: now, lastAt: now }
    state.phrases.push(entry)
  }
  entry.count += 1
  entry.lastAt = now
  entry.score += 1 + (Number.isFinite(reaction) ? reaction : 0)
  if (state.phrases.length > 60) {
    state.phrases.sort((a, b) => b.score - a.score)
    state.phrases.length = 60
  }
}

/**
 * Nightly: decay phrase scores and pick the catchphrases. A phrase needs to have
 * come up several times before it sticks; closeness lowers the bar for the
 * user's own words (people start to talk alike).
 */
export function settlePhrases(state, closeness, now) {
  for (const p of state.phrases) p.score *= 0.85
  const bar = (p) => (p.origin === 'user' ? 4.5 - 2 * closeness : 3.5)
  const chosen = state.phrases
    .filter((p) => p.score >= bar(p))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
  const before = new Set(state.persona.catchphrases.map((c) => c.text))
  state.persona.catchphrases = chosen.map((p) => ({ text: p.text, origin: p.origin, since: before.has(p.text) ? undefined : now }))
  return chosen
}

/**
 * The per-turn speaking plan: which strategy to lean on and whether to use a
 * catchphrase (keeping the rate over the last few messages).
 */
export function speechPlan(persona, text, recentPhrases, random = Math.random) {
  const lines = []
  const strategy = chooseStrategy(persona, text, random)
  if (strategy !== undefined) lines.push(`这一轮更像你的回法是「${STRATEGY_NAMES[strategy]}」：${STRATEGIES[strategy]}。但一定先回应对方说的具体内容。`)
  const phrases = persona.catchphrases.map((c) => c.text)
  let phrase = ''
  if (phrases.length) {
    const recent = recentPhrases.slice(-6)
    const rate = catchphraseRate(persona.traits)
    const due = recent.length ? recent.filter(Boolean).length / recent.length < rate : random() < rate
    if (due) {
      phrase = [...phrases].sort((a, b) => recent.lastIndexOf(a) - recent.lastIndexOf(b))[0]
      lines.push(`这一轮自然地用一次你的口头禅「${phrase}」。`)
    } else lines.push('这一轮不用口头禅。')
  }
  return { strategy, phrase, text: lines.join('\n') }
}

/**
 * Weekly growth: apply model-proposed trait changes, each capped, and pull a
 * little back towards the anchor so she stays herself.
 * @param proposals - [{ trait, delta, because }]
 * @returns the applied changes.
 */
export function applyGrowth(persona, proposals, now, cap = 0.03, pull = 0.1) {
  const applied = []
  for (const p of Array.isArray(proposals) ? proposals : []) {
    if (!TRAITS.includes(p?.trait) || !Number.isFinite(p?.delta) || !p?.because) continue
    const before = persona.traits[p.trait]
    const delta = Math.max(-cap, Math.min(cap, p.delta)) - pull * (before - persona.anchor[p.trait]) * cap
    const after = clamp01(before + delta)
    if (Math.abs(after - before) < 0.002) continue
    persona.traits[p.trait] = after
    applied.push({ trait: p.trait, from: before, to: after, because: clip(p.because, 80), note: clip(p.note, 40) })
  }
  if (applied.length) persona.growth.push({ id: `gr_${now.toString(36)}`, at: now, changes: applied })
  return applied
}

/** Undo one growth step. */
export function undoGrowth(persona, id) {
  const step = persona.growth.find((g) => g.id === id && !g.undone)
  if (step === undefined) return false
  for (const c of step.changes) persona.traits[c.trait] = c.from
  step.undone = true
  return true
}
