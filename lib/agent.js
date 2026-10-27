/**
 * dsh-nook per-agent plugin, mounted by the "Nook" agent preset.
 *
 * Makes this agent Nook: her persona is the whole system prompt, each step
 * starts with her current state (time, mood, threads, related memories, this
 * turn's speaking plan), and every exchange is handed to the engine.
 */
import { runtime, NOTICE_KIND, textOf, userMessage } from './runtime.js'

export const name = 'dsh-nook-agent'
export const inject = ['systemPrompt']

const SETUP_HINT = '你是大D老师，一个刚来到这里的 AI 伙伴。对方还没有完成「创建你的伙伴」。先友好地打个招呼，请对方点侧边栏的「大D老师」完成创建。'

export function apply(ctx) {
  const engine = () => runtime.engine

  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: 'nook:persona',
        order: 0,
        complete: true,
        interpolate: false,
        text: () => engine()?.personaText() || SETUP_HINT,
      }),
    'dsh-nook: persona',
  )

  ctx.on('agent/created', ({ agent }) => {
    runtime.nookSessions.add(agent.id)
    const options = agent.options
    if (options?.provider && options?.model) runtime.route = { provider: options.provider, model: options.model }
  })
  ctx.on('agent/disposed', ({ agent }) => {
    runtime.nookSessions.delete(agent.id)
  })

  // Her state at the start of each turn, as a snapshot the model reads first.
  ctx.on(
    'agent/pre-step',
    async ({ agent, step, signal }, next) => {
      const decision = await next()
      if (decision.kind === 'reject' || signal?.aborted || step !== 1) return decision
      const e = engine()
      if (e === undefined) return decision
      const latest = [...decision.messages].reverse().find((m) => m.role === 'user' && (m.source?.kind === 'user' || m.source?.kind === NOTICE_KIND))
      const text = e.snapshot(agent.id, latest ? textOf(latest) : '')
      if (!text) return decision
      return {
        ...decision,
        messages: [
          ...decision.messages,
          userMessage([{ type: 'text', text }], { kind: NOTICE_KIND, form: 'snapshot', sections: [{ name: 'nook', text }] }),
        ],
      }
    },
    { prepend: true },
  )

  // A companion has no use for the coding runtime context (working directory, file policy).
  ctx.effect(() => ctx.systemPrompt.suppressRuntimeContext?.(), 'dsh-nook: no runtime context')

  // Hand every exchange to the engine: what the user said, and her reply once the turn ends.
  const replies = new Map()
  const searches = new Map()
  ctx.on('session/event', (session, event) => {
    const id = session?.id ?? session?.header?.id
    if (id === undefined || !runtime.nookSessions.has(id)) return
    const e = engine()
    if (e === undefined) return
    if (event.type === 'user/message' && event.data?.source?.kind === 'user') {
      void e.userMessage(id, textOf(event.data), event.time)
    } else if (event.type === 'assistant/message') {
      const text = textOf(event.data?.message)
      if (text) replies.set(id, [...(replies.get(id) ?? []), text])
    } else if (event.type === 'tool/call' && /search|fetch/.test(event.data?.name ?? '')) {
      searches.set(event.data.callId, { name: event.data.name, arguments: event.data.arguments })
    } else if (event.type === 'tool/result') {
      const call = searches.get(event.data?.message?.toolCallId)
      if (call === undefined) return
      searches.delete(event.data.message.toolCallId)
      if (!event.data.message.isError) void e.chatLookup(id, call.name, call.arguments, textOf(event.data.message), event.time)
    } else if (event.type === 'turn/end') {
      const text = (replies.get(id) ?? []).join('\n')
      replies.delete(id)
      if (text) void e.assistantMessage(id, text, event.time).catch(() => undefined)
    }
  })
}
