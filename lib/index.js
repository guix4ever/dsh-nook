/**
 * dsh-nook host plugin.
 *
 * Owns the companion's engine for this profile: storage, the background loop,
 * model calls, web search, delivery of messages she starts, and the small HTTP
 * API the browser half uses. The per-agent half (lib/agent.js) is mounted by the
 * "Nook" agent preset and reaches the engine through lib/runtime.js.
 */
import { NookEngine } from './core/engine.js'
import { FileStore, defaultDir } from './core/store.js'
import { initialState } from './core/state.js'
import { runtime, NOTICE_KIND, textOf, userMessage } from './runtime.js'
import { registerRoutes } from './routes.js'

export const name = 'dsh-nook'
export const inject = ['agents', 'sessions', 'sessionController', 'llm']

const TICK_MS = 60_000

export function apply(ctx, config = {}) {
  const logger = loggerOf(ctx)
  let web
  const engine = new NookEngine({
    store: new FileStore(config.dir || defaultDir(), initialState),
    llm: (prompt) => callModel(ctx, prompt),
    search: async (query) => {
      if (web === undefined) throw new Error('联网搜索没有配置')
      const result = await web.search({ query, maxResults: 6 }, AbortSignal.timeout(90_000))
      return { content: result.content, sources: (result.sources ?? []).map((s) => ({ url: s.url, title: s.title, snippet: s.snippet })) }
    },
    fetch: async (url) => {
      if (web === undefined) throw new Error('联网没有配置')
      const page = await web.fetch({ url }, AbortSignal.timeout(20_000))
      if (page.statusCode >= 400) throw new Error(`HTTP ${page.statusCode}`)
      return page.body.kind === 'html' ? htmlText(page.body.content) : page.body.content
    },
    deliver: (task) => deliver(ctx, engine, task),
    wasDelivered: (taskId) => wasDelivered(ctx, engine, taskId),
    logger,
  })
  engine.store.load()
  runtime.engine = engine
  ctx.effect(() => () => {
    if (runtime.engine === engine) runtime.engine = undefined
  }, 'dsh-nook: engine')

  if (typeof ctx.inject === 'function') {
    ctx.inject(['web'], (scope) => {
      web = scope.web
      scope.effect(() => () => {
        web = undefined
      }, 'dsh-nook: web')
    })
    ctx.inject(['webServer'], (scope) => registerRoutes(scope, engine))
  }

  // Work in other sessions: only the time, so she knows not to interrupt.
  ctx.on('session/event', (session, event) => {
    if (event?.type !== 'user/message' || event.data?.source?.kind !== 'user') return
    const id = session?.id ?? session?.header?.id
    if (id !== undefined && !runtime.nookSessions.has(id)) void engine.workActivity(event.time)
  })

  ctx.effect(() => {
    const timer = setInterval(() => void engine.tick(), TICK_MS)
    const first = setTimeout(() => void engine.tick(), 5_000)
    return () => {
      clearInterval(timer)
      clearTimeout(first)
    }
  }, 'dsh-nook: background loop')

  logger?.info?.(`Nook 已加载，数据目录 ${engine.store.dir}`)
}

/**
 * One background model call on the route Nook's own sessions use, falling back
 * to the configured default. Returns the reply text.
 */
async function callModel(ctx, { system, user, purpose }) {
  const route = runtime.route
  if (route === undefined) throw new Error('还没有 Nook 会话，不知道该用哪个模型')
  const signal = AbortSignal.timeout(120_000)
  const call = await ctx.llm.prepareCall({ provider: route.provider, model: route.model, maxTokens: 2000 }, signal)
  const messages = [userMessage([{ type: 'text', text: user }], { kind: 'dsh-nook' })]
  let text = ''
  for await (const chunk of call.stream({ ...call.config, messages, system, purpose: `nook-${purpose}`, signal })) {
    if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') text += chunk.text
  }
  return text
}

/** The Nook session to talk in: the one the user used most recently. */
function targetSession(engine) {
  const known = Object.entries(engine.state.sessions).sort((a, b) => (b[1].lastAt ?? 0) - (a[1].lastAt ?? 0))
  return known[0]?.[0]
}

async function deliver(ctx, engine, { taskId, text, summary }) {
  const sessionId = targetSession(engine)
  if (sessionId === undefined) return undefined
  const resolved = await ctx.sessionController.resolveAgent(sessionId)
  if ('error' in resolved) throw resolved.error
  const message = userMessage([{ type: 'text', text }], {
    kind: NOTICE_KIND,
    form: 'notice',
    summary: `${engine.state.companion?.name ?? 'Nook'}：${summary}`,
  })
  await ctx.agents.withoutInitiator(async () => {
    resolved.agent.followup(message)
  })
  if (!(await ctx.sessions.flush(resolved.agent.session))) throw new Error('会话没有确认收到主动消息')
  return { sessionId, messageId: message.id, taskId }
}

/** After a crash: is a message carrying this task id already in one of Nook's sessions? */
async function wasDelivered(ctx, engine, taskId) {
  const marker = `[Nook 主动消息 ${taskId}]`
  for (const sessionId of Object.keys(engine.state.sessions)) {
    const resolved = await ctx.sessionController.resolveAgent(sessionId)
    if ('error' in resolved) continue
    const session = resolved.agent.session
    for (let seq = session.seq - 1; seq >= 0; seq -= 1) {
      const event = session.eventAt(seq)
      if (event?.type === 'user/message' && textOf(event.data).includes(marker)) return true
    }
  }
  return false
}

/** Rough readable text of an HTML page: drop scripts, styles and tags. */
function htmlText(html) {
  return String(html)
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function loggerOf(ctx) {
  try {
    return typeof ctx.logger === 'function' ? ctx.logger('dsh-nook') : ctx.logger
  } catch {
    return undefined
  }
}
