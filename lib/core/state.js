/**
 * Shape of a companion's state file. Everything here can be rebuilt from the
 * event log in principle; it is kept as a file so each request reads it in
 * constant time.
 */

export const STATE_VERSION = 1

/** Areas of the user's life Nook tries to get to know (the "认识你" map). */
export const KNOW_AREAS = {
  routine: '作息和日常',
  work: '工作或学习',
  people: '身边重要的人',
  likes: '喜欢的东西',
  dislikes: '不喜欢、雷区',
  worries: '最近的烦恼',
  hopes: '想做的事',
  past: '过去的故事',
  place: '住在哪里',
}

export function initialState() {
  return {
    version: STATE_VERSION,
    /** Unset until the user finishes the "创建你的伙伴" dialog. */
    companion: undefined,
    settings: {
      enabled: true,
      timeZone: undefined,
      /** How often she may reach out: 'low' | 'medium' | 'high'. */
      outreach: 'medium',
      sleep: { start: '00:30', end: '08:30' },
      respectWork: true,
      explore: true,
      dailyBudgetCalls: 60,
    },
    persona: undefined,
    mood: { valence: 0.2, arousal: 0.4, label: '平静', reason: '', at: 0 },
    /** Modifiers on the relationship, folded into closeness and grudge (see affect.js). */
    bond: { mods: [], stage: 0, stageAt: 0 },
    /** Long-term memory items (see memory.js). */
    memories: [],
    /** Ongoing threads in the user's life and in Nook's own (see threads.js). */
    threads: [],
    /** Daily timeline cards, newest last. */
    days: [],
    /** Things she read on her own (see explore.js). */
    notes: [],
    /** Candidate phrases for catchphrases (see persona.js). */
    phrases: [],
    /** Outreach tasks and their delivery state (see outreach.js). */
    outreach: { tasks: [], lastSentAt: 0, unanswered: 0, sentToday: { day: '', count: 0 } },
    /** Per-session bookkeeping: last activity, last user and assistant messages. */
    sessions: {},
    /** When the user last said anything to Nook, in any session. */
    lastUserAt: 0,
    /** Latest activity in work (non-Nook) sessions, to avoid interrupting. */
    lastWorkActivityAt: 0,
    /** Background model calls made today, against settings.dailyBudgetCalls. */
    budget: { day: '', calls: 0 },
    /** Next times the background loop wants to run each job. */
    schedule: { explore: 0, consolidate: 0, growth: 0 },
    /** A one-line reminder left by the character check for the next turn. */
    reminder: '',
  }
}
