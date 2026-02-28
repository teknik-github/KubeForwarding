<script setup lang="ts">
import AddForwardModal from '~/components/AddForwardModal.vue'
import ForwardCard from '~/components/ForwardCard.vue'

const { forwards, connected, stopForward } = useForwards()

const showModal = ref(false)

// Non-blocking cluster fetch
const cluster = ref<{ context: string; server: string; cluster: string; localIp: string } | null>(null)
$fetch('/api/cluster').then(c => { cluster.value = c as any })

// When modal emits 'created', immediately add to local state so the card
// appears at once — SSE will reconcile if needed
function handleCreated(forward: any) {
  showModal.value = false
  if (forward && !forwards.value.find(f => f.id === forward.id)) {
    forwards.value.push(forward)
  }
}

const activeCount = computed(() => forwards.value.filter(f => f.status === 'running').length)

async function handleStop(id: string) {
  try {
    await stopForward(id)
  } catch (e: any) {
    console.error('Stop failed:', e.message)
  }
}

// Sort: running first, then by createdAt desc
const sortedForwards = computed(() =>
  [...forwards.value].sort((a, b) => {
    if (a.status === 'running' && b.status !== 'running') return -1
    if (b.status === 'running' && a.status !== 'running') return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  }),
)
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Top bar -->
    <header class="sticky top-0 z-30 bg-[#0a0a0a]/90 backdrop-blur border-b border-[#1e1e1e] px-6 py-3">
      <div class="max-w-6xl mx-auto flex items-center gap-4">
        <!-- Logo / title -->
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-xs font-bold">K</div>
          <span class="font-semibold text-gray-200">Kube Forwarder</span>
        </div>

        <!-- Cluster info -->
        <div class="flex items-center gap-2 text-xs text-[#555] ml-4">
          <span
            class="w-1.5 h-1.5 rounded-full"
            :class="connected ? 'bg-emerald-500 animate-pulse' : 'bg-[#444]'"
          />
          <span class="font-mono text-[#666]">{{ cluster?.context ?? '…' }}</span>
          <span class="text-[#333]">|</span>
          <span class="font-mono text-[#555] truncate max-w-xs">{{ cluster?.server ?? '…' }}</span>
        </div>

        <div class="flex-1" />

        <!-- Active count badge -->
        <div
          v-if="activeCount"
          class="text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-0.5 rounded-full"
        >
          {{ activeCount }} active
        </div>

        <!-- Add button -->
        <button
          class="flex items-center gap-1.5 text-sm px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
          @click="showModal = true"
        >
          <span class="text-base leading-none">+</span>
          New Forward
        </button>
      </div>
    </header>

    <!-- Main content -->
    <main class="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
      <!-- Stats strip -->
      <div class="flex items-center gap-6 mb-8 text-xs text-[#555]">
        <div>
          <span class="text-gray-400 font-medium">{{ forwards.length }}</span> total
        </div>
        <div>
          <span class="text-emerald-400 font-medium">{{ activeCount }}</span> running
        </div>
        <div>
          <span class="text-red-400 font-medium">{{ forwards.filter(f => f.status === 'error').length }}</span> errors
        </div>
        <div class="flex-1" />
        <div class="flex items-center gap-1.5">
          <span
            class="w-1.5 h-1.5 rounded-full"
            :class="connected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'"
          />
          <span>{{ connected ? 'Live' : 'Reconnecting…' }}</span>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="!forwards.length" class="flex flex-col items-center justify-center py-24 text-center">
        <div class="text-5xl mb-4 opacity-20">⇄</div>
        <p class="text-gray-500 text-sm mb-2">No active port forwards</p>
        <p class="text-[#555] text-xs mb-6">Click "New Forward" to tunnel into a pod or service</p>
        <button
          class="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
          @click="showModal = true"
        >
          <span>+</span> New Forward
        </button>
      </div>

      <!-- Forward cards grid -->
      <div
        v-else
        class="grid gap-4"
        style="grid-template-columns: repeat(auto-fill, minmax(340px, 1fr))"
      >
        <ForwardCard
          v-for="fwd in sortedForwards"
          :key="fwd.id"
          :forward="fwd"
          :local-ip="cluster?.localIp ?? '127.0.0.1'"
          @stop="handleStop"
        />
      </div>
    </main>

    <!-- Add forward modal -->
    <AddForwardModal
      v-if="showModal"
      @close="showModal = false"
      @created="handleCreated"
    />
  </div>
</template>
