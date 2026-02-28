import { listForwards, subscribeEvents } from '../../utils/forwarder'

export default defineEventHandler(async (event) => {
  const res = event.node.res
  const req = event.node.req

  // Write SSE headers and flush immediately so the browser sees the connection
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders()

  function send(data: string) {
    if (res.writableEnded) return
    res.write(`data: ${data}\n\n`)
  }

  // Push current state immediately
  send(JSON.stringify({ type: 'init', forwards: listForwards() }))

  const unsubscribe = subscribeEvents(send)

  const pingTimer = setInterval(() => {
    if (res.writableEnded) return clearInterval(pingTimer)
    res.write(': ping\n\n') // SSE comment — keeps proxy connections alive
  }, 15_000)

  req.on('close', () => {
    clearInterval(pingTimer)
    unsubscribe()
    if (!res.writableEnded) res.end()
  })

  // Keep the handler alive until the client disconnects
  event.node.req.socket?.setTimeout(0) // disable socket idle timeout
  await new Promise<void>((resolve) => req.on('close', resolve))
})
