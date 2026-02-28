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

export const useForwards = () => {
  const forwards = useState<ForwardRule[]>('forwards', () => [])
  const connected = ref(false)
  let es: EventSource | null = null

  const connect = () => {
    if (es) es.close()

    es = new EventSource('/api/forwards/events')

    es.onopen = () => { connected.value = true }

    es.onmessage = (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { type: string; [k: string]: any }

      switch (data.type) {
        case 'init':
          forwards.value = data.forwards
          break
        case 'add':
          if (!forwards.value.find(f => f.id === data.forward.id)) {
            forwards.value.push(data.forward)
          }
          break
        case 'remove':
          forwards.value = forwards.value.filter(f => f.id !== data.id)
          break
        case 'update': {
          const idx = forwards.value.findIndex(f => f.id === data.forward?.id)
          if (idx >= 0) forwards.value.splice(idx, 1, data.forward)
          break
        }
        case 'log': {
          const fwd = forwards.value.find(f => f.id === data.id)
          if (fwd) fwd.logs.push(data.message)
          break
        }
        case 'stat': {
          const fwd = forwards.value.find(f => f.id === data.id)
          if (fwd) fwd.connections = data.connections
          break
        }
      }
    }

    es.onerror = () => {
      connected.value = false
      es?.close()
      setTimeout(connect, 3000)
    }
  }

  onMounted(connect)
  onUnmounted(() => {
    es?.close()
    connected.value = false
  })

  const stopForward = async (id: string) => {
    await $fetch(`/api/forwards/${id}`, { method: 'DELETE' })
  }

  const createForward = async (data: {
    namespace: string
    resourceType: 'pod' | 'service'
    resourceName: string
    localPort: number
    remotePort: number
  }) => {
    return await $fetch<ForwardRule>('/api/forwards', { method: 'POST', body: data })
  }

  return { forwards, connected, stopForward, createForward }
}
