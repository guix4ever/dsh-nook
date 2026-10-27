/**
 * Wall-clock helpers in the user's time zone. Nook reasons about "tonight",
 * "her sleep hours" and "yesterday", so every calculation goes through the zone
 * rather than the host's UTC clock.
 */

const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** The host's zone, used when the user has not set one. */
export function defaultTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'
}

const formatters = new Map()
function formatterFor(timeZone) {
  let f = formatters.get(timeZone)
  if (f === undefined) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    })
    formatters.set(timeZone, f)
  }
  return f
}

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

/** Local calendar fields of an instant in `timeZone`. */
export function localParts(now, timeZone) {
  const parts = Object.fromEntries(formatterFor(timeZone).formatToParts(new Date(now)).map((p) => [p.type, p.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
  }
}

/** "HH:MM" → minutes after midnight; invalid input returns undefined. */
export function parseClock(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim())
  if (!match) return undefined
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return undefined
  return h * 60 + m
}

/** Minutes after local midnight. */
export function minuteOfDay(now, timeZone) {
  const p = localParts(now, timeZone)
  return p.hour * 60 + p.minute
}

/** Whether `now` falls inside a local window that may cross midnight, e.g. 23:00–09:00. */
export function inWindow(now, timeZone, start, end) {
  const s = parseClock(start)
  const e = parseClock(end)
  if (s === undefined || e === undefined || s === e) return false
  const m = minuteOfDay(now, timeZone)
  return s < e ? m >= s && m < e : m >= s || m < e
}

/** Next instant at or after `now` (strictly after when equal) whose local time is `clock`. */
export function nextAt(now, timeZone, clock) {
  const target = parseClock(clock)
  if (target === undefined) return undefined
  const current = minuteOfDay(now, timeZone)
  const seconds = new Date(now).getUTCSeconds() * 1000 + new Date(now).getUTCMilliseconds()
  let delta = (target - current + 1440) % 1440
  if (delta === 0) delta = 1440
  return now - seconds + delta * MINUTE
}

/**
 * The logical day an instant belongs to, as YYYY-MM-DD. A day starts at
 * `startHour` local time, so 02:00 still counts as the previous evening.
 */
export function dayKey(now, timeZone, startHour = 5) {
  const p = localParts(now - startHour * HOUR, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** "10 月 27 日 周二 21:40" in the user's zone. */
export function describeNow(now, timeZone) {
  const p = localParts(now, timeZone)
  return `${p.month} 月 ${p.day} 日 周${WEEKDAYS[p.weekday]} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

/** Rough part of day, for greetings and tone. */
export function partOfDay(now, timeZone) {
  const h = localParts(now, timeZone).hour
  if (h < 5) return '深夜'
  if (h < 9) return '早上'
  if (h < 12) return '上午'
  if (h < 14) return '中午'
  if (h < 18) return '下午'
  if (h < 23) return '晚上'
  return '深夜'
}

/** A human gap such as "3 分钟" "22 小时" "2 天". */
export function describeGap(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '未知'
  if (ms < 2 * MINUTE) return '刚刚'
  if (ms < HOUR) return `${Math.round(ms / MINUTE)} 分钟`
  if (ms < DAY) return `${Math.round(ms / HOUR)} 小时`
  return `${Math.round(ms / DAY)} 天`
}
