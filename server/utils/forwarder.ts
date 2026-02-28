import * as net from 'net'
import * as stream from 'stream'
import { getCoreV1Api, getPortForwarder } from './k8s'

export interface ForwardRule {
  id: string
  namespace: string
  resourceType: 'pod' | 'service'
  resourceName: string
  localPort: number
  remotePort: number
  status: 'running' | 'stopped' | 'error'
  error?: string
  createdAt: string
  logs: string[]
  connections: number
}

interface ActiveForward extends ForwardRule {
  server: net.Server
}

// Survive Nitro HMR reloads in dev
const g = globalThis as any
if (!g.__fwdMap) g.__fwdMap = new Map<string, ActiveForward>()
if (!g.__fwdListeners) g.__fwdListeners = new Set<(data: string) => void>()

const forwards: Map<string, ActiveForward> = g.__fwdMap
const eventListeners: Set<(data: string) => void> = g.__fwdListeners

// ── SSE event bus ──────────────────────────────────────────────────────────

function emit(data: object) {
  const str = JSON.stringify(data)
  for (const fn of eventListeners) {
    try { fn(str) } catch {}
  }
}

export function subscribeEvents(fn: (data: string) => void): () => void {
  eventListeners.add(fn)
  return () => eventListeners.delete(fn)
}

// ── Accessors ──────────────────────────────────────────────────────────────

export function listForwards(): ForwardRule[] {
  return Array.from(forwards.values()).map(({ server: _s, ...rule }) => rule)
}

export function getForward(id: string): ForwardRule | undefined {
  const f = forwards.get(id)
  if (!f) return undefined
  const { server: _s, ...rule } = f
  return rule
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function resolvePod(namespace: string, resourceType: string, resourceName: string): Promise<string> {
  if (resourceType === 'pod') return resourceName

  const api = getCoreV1Api()
  const svcResult = await api.readNamespacedService(resourceName, namespace)
  const svc = svcResult.body
  const selector = svc.spec?.selector ?? {}

  if (!Object.keys(selector).length) {
    throw new Error(`Service "${resourceName}" has no pod selector`)
  }

  const labelSelector = Object.entries(selector).map(([k, v]) => `${k}=${v}`).join(',')
  const podsResult = await api.listNamespacedPod(
    namespace,
    undefined, undefined, undefined, undefined,
    labelSelector,
  )
  const pod = podsResult.body.items.find((p: any) => p.status?.phase === 'Running')

  if (!pod?.metadata?.name) {
    throw new Error(`No running pods found for service "${resourceName}"`)
  }
  return pod.metadata.name
}

function addLog(rule: ForwardRule, msg: string) {
  const entry = `[${new Date().toTimeString().slice(0, 8)}] ${msg}`
  rule.logs.push(entry)
  if (rule.logs.length > 200) rule.logs.shift()
  emit({ type: 'log', id: rule.id, message: entry })
}

// ── Core operations ────────────────────────────────────────────────────────

export async function createForward(opts: {
  namespace: string
  resourceType: 'pod' | 'service'
  resourceName: string
  localPort: number
  remotePort: number
}): Promise<ForwardRule> {
  // Check for port conflict
  for (const fwd of forwards.values()) {
    if (fwd.localPort === opts.localPort && fwd.status === 'running') {
      throw new Error(`Local port ${opts.localPort} is already in use by ${fwd.resourceName}`)
    }
  }

  const id = crypto.randomUUID()
  const rule: ForwardRule = {
    id,
    ...opts,
    status: 'running',
    createdAt: new Date().toISOString(),
    logs: [],
    connections: 0,
  }

  addLog(rule, `Starting ${opts.localPort}:${opts.remotePort} → ${opts.namespace}/${opts.resourceName}`)

  const forwarder = getPortForwarder()

  const server = net.createServer(async (socket) => {
    rule.connections++
    emit({ type: 'stat', id, connections: rule.connections })

    socket.on('close', () => {
      rule.connections = Math.max(0, rule.connections - 1)
      emit({ type: 'stat', id, connections: rule.connections })
    })

    try {
      const podName = await resolvePod(opts.namespace, opts.resourceType, opts.resourceName)
      addLog(rule, `Connection → ${podName}:${opts.remotePort}`)

      // Stream 0 (even channels): data from the pod → client socket
      // Stream 1 (odd channels):  k8s error channel (e.g. "connection refused")
      //   — we capture it to log, and also forward so the client sees it.
      const dataStream = new stream.PassThrough()
      dataStream.on('data', (chunk: Buffer) => {
        if (!socket.writableEnded) socket.write(chunk)
      })
      dataStream.on('error', () => {})

      const errStream = new stream.PassThrough()
      errStream.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8').trim()
        if (text) addLog(rule, `Pod error: ${text.slice(0, 300)}`)
        // Also forward error bytes to client so browser/tool sees the message
        if (!socket.writableEnded) socket.write(chunk)
      })
      errStream.on('error', () => {})

      // retryCount=0: WebSocket created immediately — errors surface via catch,
      // and works for protocols where the server speaks first (Redis, MySQL, …)
      const ws = await forwarder.portForward(
        opts.namespace,
        podName,
        [opts.remotePort],
        dataStream,  // stream 0: pod data → client
        errStream,   // stream 1: k8s error messages → log + client
        socket,      // client data → pod
        0,
      )

      const getWs = typeof ws === 'function' ? ws : () => ws
      const closeWs = () => { try { const w = getWs(); if (w) w.close() } catch {} }

      if (!(ws instanceof Function)) {
        (ws as any).on?.('error', (e: Error) => addLog(rule, `WS error: ${e.message}`))
      }

      socket.on('close', closeWs)

    } catch (err: any) {
      addLog(rule, `Error: ${err.message}`)
      socket.destroy()
    }
  })

  server.on('error', (err: any) => {
    rule.status = 'error'
    rule.error = err.message
    addLog(rule, `Server error: ${err.message}`)
    emit({ type: 'update', forward: getForward(id) })
  })

  // Bind the local port
  await new Promise<void>((resolve, reject) => {
    server.listen(opts.localPort, '0.0.0.0', () => {
      addLog(rule, `Listening on 0.0.0.0:${opts.localPort}`)
      resolve()
    })
    server.once('error', reject)
  })

  const active: ActiveForward = { ...rule, server }
  forwards.set(id, active)
  emit({ type: 'add', forward: { ...rule } })
  return rule
}

export function stopForward(id: string): boolean {
  const fwd = forwards.get(id)
  if (!fwd) return false

  fwd.server.close()
  fwd.status = 'stopped'
  forwards.delete(id)
  emit({ type: 'remove', id })
  return true
}

export function stopAllForwards() {
  for (const [id] of forwards) stopForward(id)
}
