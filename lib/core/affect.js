/**
 * Mood and relationship.
 *
 * Mood moves by the hour and drifts back to her baseline. The relationship keeps
 * closeness and hurt apart (someone can still like a friend who hurt them and be
 * waiting for an apology), and each event fades on its own clock, the way
 * opinion modifiers work in games like Crusader Kings or RimWorld.
 *
 * Two promises the code keeps: a grudge always eases once the user apologises,
 * and the relationship stage never goes backwards because of one bad moment.
 */
import { HOUR, DAY } from './clock.js'
import { clip } from './text.js'

/** What a message can mean to her, with its effect at full intensity. */
export const APPRAISALS = {
  praise: { closeness: 0.08, mood: 0.35, days: 14, label: '被夸了', intimacy: 0.6 },
  warmth: { closeness: 0.1, mood: 0.3, days: 21, label: '被关心了', intimacy: 0.8 },
  share: { closeness: 0.06, mood: 0.15, days: 14, label: '对方跟她分享', intimacy: 0.6 },
  seek_comfort: { closeness: 0.08, mood: -0.05, days: 21, label: '对方找她倾诉', intimacy: 1 },
  apology: { closeness: 0.1, mood: 0.25, days: 21, label: '对方道歉了', intimacy: 0.4 },
  offense: { grudge: 0.25, mood: -0.35, days: 10, label: '被冒犯了' },
  insult: { grudge: 0.45, mood: -0.55, days: 30, label: '被骂了' },
  neglect: { grudge: 0.05, mood: -0.25, days: 3, label: '好久没人理' },
  reunion: { closeness: 0.04, mood: 0.3, days: 7, label: '对方回来了', intimacy: 0.3 },
}

export const STAGES = {
  friend: ['认识', '聊得来', '好朋友', '知己'],
  lover: ['心动', '热恋', '稳定', '默契'],
}
const STAGE_POINTS = [0, 12, 40, 100]

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))

/** Resting mood for her temperament: emotionally steady people rest a bit higher. */
function baseline(traits) {
  return 0.15 + 0.2 * (0.5 - (traits?.N ?? 0.5))
}

/** Mood now, after drifting back to baseline since it was last set (half-life 6 hours). */
export function moodNow(mood, traits, now) {
  const base = baseline(traits)
  const t = Math.max(0, now - (mood.at ?? now)) / HOUR
  const k = Math.pow(0.5, t / 6)
  const valence = base + (mood.valence - base) * k
  const settled = k < 0.25
  return {
    valence,
    arousal: 0.3 + (mood.arousal - 0.3) * k,
    label: settled ? labelOf(valence) : mood.label,
    reason: settled ? '' : mood.reason,
    at: mood.at,
  }
}

function labelOf(v) {
  if (v >= 0.55) return '开心'
  if (v >= 0.3) return '心情不错'
  if (v >= 0.05) return '平静'
  if (v >= -0.25) return '有点低落'
  return '难过'
}

/**
 * Apply one appraised event to mood and relationship.
 * @param kind - a key of APPRAISALS.
 * @param intensity - 0–1 from the classifier.
 * @param label - her own words for how she feels now, if the model gave them.
 */
export function appraise(state, kind, intensity, reason, now, log, label, evidence) {
  const spec = APPRAISALS[kind]
  if (spec === undefined) return
  const k = clamp(Number.isFinite(intensity) ? intensity : 0.6, 0.1, 1)
  const traits = state.persona?.traits
  const sensitivity = spec.mood < 0 ? 1 + 0.8 * ((traits?.N ?? 0.5) - 0.5) * 2 : 1
  const current = moodNow(state.mood, traits, now)
  const valence = clamp(current.valence + spec.mood * k * sensitivity, -1, 1)
  state.mood = {
    valence,
    arousal: clamp(current.arousal + 0.3 * k, 0, 1),
    label: clip(label, 8) || labelOf(valence),
    reason: clip(reason || spec.label, 40),
    at: now,
  }
  const value = spec.closeness !== undefined ? spec.closeness * k : -(spec.grudge * k)
  state.bond.mods.push({ kind, value, days: spec.days, at: now, reason: clip(reason || spec.label, 40), evidence })
  if (kind === 'apology') forgive(state, now)
  state.bond.intimacy = (state.bond.intimacy ?? 0) + (spec.intimacy ?? 0) * k
  if (state.bond.mods.length > 200) state.bond.mods = state.bond.mods.filter((m) => weight(m, now) > 0).slice(-200)
  log('affect', { kind, intensity: k, mood: state.mood.label, reason: state.mood.reason, evidence })
}

/** An apology halves what is left of every hurt before it. */
function forgive(state, now) {
  for (const m of state.bond.mods) {
    if (m.value < 0 && m.at <= now && !m.forgiven) {
      m.value /= 2
      m.forgiven = true
    }
  }
}

const weight = (m, now) => Math.max(0, 1 - (now - m.at) / (m.days * DAY))

/** Closeness and grudge, each 0–1, plus the most recent hurt still felt. */
export function bondNow(state, now) {
  const n = state.persona?.traits?.N ?? 0.5
  const a = state.persona?.traits?.A ?? 0.5
  let closeness = 0
  let grudge = 0
  let hurt
  for (const m of state.bond.mods) {
    const w = weight(m, now)
    if (w === 0) continue
    if (m.value > 0) closeness += m.value * w
    else {
      // Sensitive and less agreeable people feel hurt more and longer.
      grudge += -m.value * (1 + n - 0.5 * a) * w
      if (hurt === undefined || m.at >= hurt.at) hurt = m
    }
  }
  return { closeness: Math.min(1, closeness), grudge: Math.min(1, grudge), hurt: grudge > 0.05 ? hurt : undefined }
}

/** Points towards the next stage: days talked plus meaningful moments. */
export function stageOf(state) {
  const points = state.bond.intimacy ?? 0
  let stage = 0
  for (let i = 0; i < STAGE_POINTS.length; i += 1) if (points >= STAGE_POINTS[i]) stage = i
  return Math.max(stage, state.bond.stage ?? 0)
}

/** Move the stage up if earned. Never down. */
export function settleStage(state, now, log) {
  const next = stageOf(state)
  if (next > (state.bond.stage ?? 0)) {
    const names = STAGES[state.companion?.relation ?? 'friend']
    state.bond.stage = next
    state.bond.stageAt = now
    log('bond.stage', { stage: next, name: names[Math.min(next, names.length - 1)] })
    return true
  }
  return false
}

/** Daily credit for having talked at all. */
export function creditDay(state) {
  state.bond.intimacy = (state.bond.intimacy ?? 0) + 1
}

/** Recent relationship changes with reasons, newest first, for the status panel. */
export function recentChanges(state, now, limit = 6) {
  return state.bond.mods
    .filter((m) => weight(m, now) > 0)
    .slice(-limit)
    .reverse()
    .map((m) => ({ kind: m.kind, at: m.at, reason: m.reason, sign: m.value > 0 ? 1 : -1, forgiven: !!m.forgiven }))
}
