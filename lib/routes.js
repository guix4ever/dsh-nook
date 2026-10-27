/**
 * The HTTP API the browser half uses. Loopback only, like other dsh plugins'
 * bridges: the state is personal and never leaves this machine.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = '/api/dsh-nook'
const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets')
const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' }
const LIMIT = 256 * 1024

export function registerRoutes(scope, engine) {
  const route = (path, method, handler) =>
    scope.effect(
      () =>
        scope.webServer.register({
          kind: 'exact',
          path: `${BASE}${path}`,
          handler: async (request, response) => {
            if (!isLoopback(request)) return json(response, 403, { ok: false, error: 'loopback only' })
            if ((request.method ?? 'GET') !== method) return json(response, 405, { ok: false, error: 'method not allowed' })
            try {
              const body = method === 'POST' ? await readBody(request) : undefined
              if (method === 'POST' && body === undefined) return json(response, 400, { ok: false, error: 'bad body' })
              json(response, 200, { ok: true, ...(await handler(body)) })
            } catch (error) {
              json(response, 500, { ok: false, error: String(error?.message ?? error) })
            }
          },
        }),
      `dsh-nook: ${path}`,
    )

  route('/view', 'GET', async () => ({ view: engine.view() }))
  route('/setup', 'POST', async (b) => ({ companion: await engine.setup({ name: b.name, relation: b.relation, mbti: b.mbti }) }))
  route('/settings', 'POST', async (b) => ({ settings: await engine.updateSettings(b) }))
  route('/memory', 'POST', async (b) => {
    if (b.action === 'forget') return { done: await engine.forget(b.id) }
    if (b.action === 'correct') return { done: !!(await engine.correct(b.id, String(b.text ?? ''))) }
    if (b.action === 'invalidate') return { done: !!(await engine.invalidate(b.id)) }
    if (b.action === 'seal') return { done: await engine.sealTopic(String(b.topic ?? '')) }
    if (b.action === 'remember') return { done: !!(await engine.remember(String(b.text ?? ''))) }
    throw new Error('unknown action')
  })
  route('/growth/undo', 'POST', async (b) => ({ done: await engine.undoGrowth(b.id) }))

  // Illustrations shipped in assets/, one exact route per file.
  let files = []
  try {
    files = fs.readdirSync(ASSETS).filter((f) => TYPES[path.extname(f)])
  } catch {}
  for (const file of files) {
    scope.effect(
      () =>
        scope.webServer.register({
          kind: 'exact',
          path: `${BASE}/asset/${file}`,
          handler: (request, response) => {
            if (!isLoopback(request)) return json(response, 403, { ok: false })
            response.writeHead?.(200, { 'content-type': TYPES[path.extname(file)], 'cache-control': 'max-age=86400' })
            response.end?.(fs.readFileSync(path.join(ASSETS, file)))
          },
        }),
      `dsh-nook: asset ${file}`,
    )
  }
  route('/assets', 'GET', async () => ({ files }))
}

function isLoopback(request) {
  const address = request?.socket?.remoteAddress
  if (!(address === undefined || address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1')) return false
  const host = request?.headers?.host
  if (typeof host !== 'string') return true
  try {
    const hostname = new URL(`http://${host}`).hostname
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]'
  } catch {
    return false
  }
}

function json(response, status, payload) {
  response.writeHead?.(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end?.(JSON.stringify(payload))
}

function readBody(request) {
  return new Promise((resolve) => {
    const chunks = []
    let size = 0
    let done = false
    const finish = (v) => {
      if (!done) {
        done = true
        resolve(v)
      }
    }
    request.on('data', (c) => {
      size += c.length
      if (size > LIMIT) {
        finish(undefined)
        request.destroy?.()
      } else chunks.push(c)
    })
    request.on('end', () => {
      if (chunks.length === 0) return finish({})
      try {
        finish(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        finish(undefined)
      }
    })
    request.on('error', () => finish(undefined))
  })
}
