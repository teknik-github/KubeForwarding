<script setup lang="ts">
import type { ForwardRule } from '~/composables/useForwards'

const props = defineProps<{ forward: ForwardRule; localIp: string }>()
const emit = defineEmits<{ stop: [id: string] }>()

const showLogs = ref(false)
const logsRef = ref<HTMLElement | null>(null)

const statusColor = computed(() => {
  switch (props.forward.status) {
    case 'running': return 'text-emerald-400'
    case 'error': return 'text-red-400'
    default: return 'text-gray-500'
  }
})

const statusDot = computed(() => {
  switch (props.forward.status) {
    case 'running': return 'bg-emerald-400'
    case 'error': return 'bg-red-400'
    default: return 'bg-gray-600'
  }
})

const resourceIcon = computed(() =>
  props.forward.resourceType === 'service' ? '⬡' : '◉'
)

const age = computed(() => {
  const diff = Date.now() - new Date(props.forward.createdAt).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
})

watch(() => props.forward.logs.length, async () => {
  if (showLogs.value) {
    await nextTick()
    if (logsRef.value) logsRef.value.scrollTop = logsRef.value.scrollHeight
  }
})
</script>

<template>
  <div
    class="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 flex flex-col gap-3 hover:border-[#3a3a3a] transition-colors"
    :class="{ 'border-red-900/50': forward.status === 'error' }"
  >
    <!-- Header row -->
    <div class="flex items-start justify-between gap-2">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-mono text-[#6a6a6a] bg-[#252525] px-2 py-0.5 rounded">
            {{ forward.namespace }}
          </span>
          <span class="text-xs text-[#888]">{{ resourceIcon }}</span>
          <span class="text-sm font-medium text-gray-200 truncate">{{ forward.resourceName }}</span>
        </div>
        <div class="mt-1 text-[11px] text-[#666]">{{ forward.resourceType }} · {{ age }} ago</div>
      </div>

      <!-- Status indicator -->
      <div class="flex items-center gap-1.5 shrink-0">
        <span
          class="w-2 h-2 rounded-full shrink-0"
          :class="[statusDot, forward.status === 'running' ? 'animate-pulse' : '']"
        />
        <span class="text-xs" :class="statusColor">{{ forward.status }}</span>
      </div>
    </div>

    <!-- Port mapping -->
    <div class="flex items-center gap-2">
      <div class="flex items-center gap-2 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 font-mono text-sm flex-1">
        <span class="text-blue-400">{{ localIp }}:{{ forward.localPort }}</span>
        <span class="text-[#444]">→</span>
        <span class="text-gray-400">{{ forward.remotePort }}</span>
      </div>

      <!-- Connection badge -->
      <div class="flex items-center gap-1 text-xs text-[#666] bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-2 py-2">
        <span>⇄</span>
        <span>{{ forward.connections }}</span>
      </div>
    </div>

    <!-- Error message -->
    <div v-if="forward.error" class="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
      {{ forward.error }}
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2">
      <button
        class="text-xs text-[#888] hover:text-gray-300 flex items-center gap-1.5 transition-colors"
        @click="showLogs = !showLogs"
      >
        <span class="font-mono">{{ showLogs ? '▾' : '▸' }}</span>
        Logs ({{ forward.logs.length }})
      </button>

      <div class="flex-1" />

      <a
        :href="`http://${localIp}:${forward.localPort}`"
        target="_blank"
        class="text-xs px-2.5 py-1 rounded-md bg-[#252525] hover:bg-[#303030] text-[#888] hover:text-gray-300 transition-colors font-mono"
        title="Open in browser"
      >
        ↗ open
      </a>

      <button
        class="text-xs px-2.5 py-1 rounded-md bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 transition-colors"
        @click="emit('stop', forward.id)"
      >
        ■ stop
      </button>
    </div>

    <!-- Log viewer -->
    <div v-if="showLogs" class="mt-1">
      <div
        ref="logsRef"
        class="h-40 overflow-y-auto bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-2 font-mono text-[11px] text-[#6a6a6a] space-y-0.5"
      >
        <div v-if="!forward.logs.length" class="text-[#444] italic">No logs yet…</div>
        <div v-for="(line, i) in forward.logs" :key="i" class="leading-relaxed">
          {{ line }}
        </div>
      </div>
    </div>
  </div>
</template>
