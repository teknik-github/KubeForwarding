<script setup lang="ts">
const emit = defineEmits<{
  close: []
  created: [forward: any]
}>()

interface Resource { name: string; ports: { port: number; name?: string }[] }

const form = reactive({
  namespace: 'default',
  resourceType: 'pod' as 'pod' | 'service',
  resourceName: '',
  localPort: '',
  remotePort: '',
})

const loading = ref(false)
const error = ref('')

// Namespace list — non-blocking fetch
const namespaces = ref<string[]>([])
$fetch<string[]>('/api/namespaces').then(ns => { namespaces.value = ns })

// Resource list — refetch when namespace or type changes
const resources = ref<Resource[]>([])
const resourcesLoading = ref(false)

async function fetchResources() {
  if (!form.namespace) return
  resourcesLoading.value = true
  form.resourceName = ''
  form.remotePort = ''
  try {
    resources.value = await $fetch<Resource[]>('/api/resources', {
      query: { namespace: form.namespace, type: form.resourceType },
    })
  } catch {
    resources.value = []
  } finally {
    resourcesLoading.value = false
  }
}

watch([() => form.namespace, () => form.resourceType], fetchResources, { immediate: true })

// When resource changes, suggest first port
watch(() => form.resourceName, (name) => {
  const res = resources.value.find(r => r.name === name)
  if (res?.ports.length) {
    form.remotePort = String(res.ports[0].port)
    if (!form.localPort) form.localPort = String(res.ports[0].port)
  }
})

function selectPort(port: number) {
  form.remotePort = String(port)
  if (!form.localPort) form.localPort = String(port)
}

const selectedResource = computed(() => resources.value.find(r => r.name === form.resourceName))

async function submit() {
  error.value = ''
  if (!form.resourceName) return (error.value = 'Select a resource')
  if (!form.localPort) return (error.value = 'Enter a local port')
  if (!form.remotePort) return (error.value = 'Enter a remote port')

  loading.value = true
  try {
    const forward = await $fetch('/api/forwards', {
      method: 'POST',
      body: {
        namespace: form.namespace,
        resourceType: form.resourceType,
        resourceName: form.resourceName,
        localPort: Number(form.localPort),
        remotePort: Number(form.remotePort),
      },
    })
    emit('created', forward)
    emit('close')
  } catch (e: any) {
    error.value = e.data?.message ?? e.message ?? 'Unknown error'
  } finally {
    loading.value = false
  }
}

// Close on Escape
onMounted(() => {
  const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') emit('close') }
  window.addEventListener('keydown', handler)
  onUnmounted(() => window.removeEventListener('keydown', handler))
})
</script>

<template>
  <!-- Backdrop -->
  <div
    class="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-4"
    @click.self="emit('close')"
  >
    <!-- Modal -->
    <div class="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-md shadow-2xl z-50">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
        <h2 class="text-base font-semibold text-gray-200">New Port Forward</h2>
        <button
          class="text-[#666] hover:text-gray-300 transition-colors text-lg leading-none"
          @click="emit('close')"
        >✕</button>
      </div>

      <form class="px-6 py-5 space-y-4" @submit.prevent="submit">
        <!-- Namespace -->
        <div>
          <label class="block text-xs text-[#888] mb-1.5 uppercase tracking-wider">Namespace</label>
          <select
            v-model="form.namespace"
            class="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-600 transition-colors"
          >
            <option v-if="!namespaces.length" value="default">default</option>
            <option v-for="ns in namespaces" :key="ns" :value="ns">{{ ns }}</option>
          </select>
        </div>

        <!-- Resource type -->
        <div>
          <label class="block text-xs text-[#888] mb-1.5 uppercase tracking-wider">Type</label>
          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 py-2 rounded-lg text-sm border transition-colors"
              :class="form.resourceType === 'pod'
                ? 'bg-blue-600/20 border-blue-600/60 text-blue-400'
                : 'bg-[#0f0f0f] border-[#2a2a2a] text-[#888] hover:text-gray-300'"
              @click="form.resourceType = 'pod'"
            >◉ Pod</button>
            <button
              type="button"
              class="flex-1 py-2 rounded-lg text-sm border transition-colors"
              :class="form.resourceType === 'service'
                ? 'bg-blue-600/20 border-blue-600/60 text-blue-400'
                : 'bg-[#0f0f0f] border-[#2a2a2a] text-[#888] hover:text-gray-300'"
              @click="form.resourceType = 'service'"
            >⬡ Service</button>
          </div>
        </div>

        <!-- Resource name -->
        <div>
          <label class="block text-xs text-[#888] mb-1.5 uppercase tracking-wider">
            Resource
            <span v-if="resourcesLoading" class="text-[#555] normal-case ml-1">loading…</span>
            <span v-else-if="resources.length" class="text-[#555] normal-case ml-1">({{ resources.length }} found)</span>
          </label>
          <select
            v-model="form.resourceName"
            class="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-600 transition-colors"
            :disabled="resourcesLoading"
          >
            <option value="">— select —</option>
            <option v-for="r in resources" :key="r.name" :value="r.name">{{ r.name }}</option>
          </select>

          <!-- Quick-port buttons -->
          <div v-if="selectedResource?.ports.length" class="flex flex-wrap gap-1.5 mt-2">
            <button
              v-for="p in selectedResource.ports"
              :key="p.port"
              type="button"
              class="text-xs px-2 py-0.5 rounded border transition-colors"
              :class="form.remotePort === String(p.port)
                ? 'bg-blue-600/20 border-blue-600/60 text-blue-400'
                : 'bg-[#252525] border-[#333] text-[#888] hover:text-gray-300'"
              @click="selectPort(p.port)"
            >
              {{ p.port }}<span v-if="p.name" class="text-[#555]">/{{ p.name }}</span>
            </button>
          </div>
          <div v-else-if="form.resourceName && !resourcesLoading" class="mt-1 text-xs text-[#555]">
            No ports defined — enter port manually below
          </div>
        </div>

        <!-- Ports row -->
        <div class="flex gap-3 items-end">
          <div class="flex-1">
            <label class="block text-xs text-[#888] mb-1.5 uppercase tracking-wider">Local port</label>
            <input
              v-model="form.localPort"
              type="number"
              min="1"
              max="65535"
              placeholder="e.g. 8080"
              class="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm font-mono text-blue-400 placeholder-[#444] focus:outline-none focus:border-blue-600 transition-colors"
            />
          </div>

          <div class="text-[#444] pb-2 text-lg">→</div>

          <div class="flex-1">
            <label class="block text-xs text-[#888] mb-1.5 uppercase tracking-wider">Pod port</label>
            <input
              v-model="form.remotePort"
              type="number"
              min="1"
              max="65535"
              placeholder="e.g. 80"
              class="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm font-mono text-gray-400 placeholder-[#444] focus:outline-none focus:border-blue-600 transition-colors"
            />
          </div>
        </div>

        <!-- Error -->
        <div v-if="error" class="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
          {{ error }}
        </div>

        <!-- Submit -->
        <div class="flex gap-2 pt-1">
          <button
            type="button"
            class="flex-1 py-2 rounded-lg text-sm text-[#888] hover:text-gray-300 border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors"
            @click="emit('close')"
          >Cancel</button>
          <button
            type="submit"
            class="flex-1 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="loading"
          >
            {{ loading ? 'Starting…' : 'Start Forward' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
