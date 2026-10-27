/**
 * Development-only overlay: HTTP routes to chat with Nook and run her
 * background jobs on demand, so the real loop can be exercised against a live
 * model without a browser. Mount with `dsh web --patch test/dev/harness.patch.yml`.
 */
import { randomUUID } from 'node:crypto'
import { runtime, textOf } from '../../lib/runtime.js'

export const name = 'dsh-nook-dev-harness'
export const inject = ['sessionController', 'webServer']

export function apply(ctx) {
  const route = (path, handler) =>
    ctx.effect(
      () =>
        ctx.webServer.register({
          kind: 'exact',
          path: `/api/nook-dev/${path}`,
          handler: async (request, response) => {
            const body = await readBody(request)
            try {
              const out = await handler(body)
              response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
              response.end(JSON.stringify(out))
            } catch (error) {
              response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
              response.end(JSON.stringify({ error: String(error?.stack ?? error) }))
            }
          },
        }),
      `nook-dev: ${path}`,
    )

  route('session', async (b) => ctx.sessionController.create({ cwd: b.cwd || process.cwd(), agentPreset: b.preset || 'nook' }))

  route('chat', async (b) => {
    const sessionId = b.sessionId
    await ctx.sessionController.prompt(
      { requestId: randomUUID(), sessionId, mode: 'queue', content: [{ type: 'text', text: b.text }], clientTimeZone: 'Asia/Shanghai' },
      AbortSignal.timeout(300_000),
    )
    const resolved = await ctx.sessionController.resolveAgent(sessionId)
    if ('error' in resolved) throw resolved.error
    await new Promise((r) => setTimeout(r, 300))
    await resolved.agent.whenIdle()
    return { reply: lastAssistant(resolved.agent.session) }
  })

  route('transcript', async (b) => {
    const resolved = await ctx.sessionController.resolveAgent(b.sessionId)
    if ('error' in resolved) throw resolved.error
    const s = resolved.agent.session
    const out = []
    for (let seq = 0; seq < s.seq; seq += 1) {
      const e = s.eventAt(seq)
      if (e?.type === 'user/message') out.push({ role: 'user', kind: e.data.source?.kind, form: e.data.source?.form, text: textOf(e.data) })
      if (e?.type === 'assistant/message') out.push({ role: 'assistant', text: textOf(e.data.message) })
      if (e?.type === 'tool/call') out.push({ role: 'tool', text: `${e.data.name} ${e.data.arguments}` })
    }
    return { events: out }
  })

  route('engine', async (b) => {
    const e = runtime.engine
    if (b.job === 'state') return { state: e.state }
    if (b.job === 'set') {
      await e.store.transact((st) => {
        Object.assign(st.schedule, b.schedule ?? {})
        Object.assign(st, b.patch ?? {})
      })
      return { ok: true }
    }
    await e[b.job](...(b.args ?? []))
    return { ok: true, view: e.view() }
  })
}

function lastAssistant(session) {
  for (let seq = session.seq - 1; seq >= 0; seq -= 1) {
    const e = session.eventAt(seq)
    if (e?.type === 'assistant/message') return textOf(e.data.message)
  }
  return ''
}

function readBody(request) {
  return new Promise((resolve) => {
    const chunks = []
    request.on('data', (c) => chunks.push(c))
    request.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {})
      } catch {
        resolve({})
      }
    })
  })
}
