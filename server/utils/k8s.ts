import * as k8s from '@kubernetes/client-node'
import * as os from 'os'

// Persist across Nitro HMR reloads in dev
const g = globalThis as any

function getKubeConfig(): k8s.KubeConfig {
  if (!g.__kubeConfig) {
    const kc = new k8s.KubeConfig()
    // KUBE_CONFIG_PATH: explicit path to a kubeconfig file
    // KUBECONFIG: standard kubectl env var (also supported by loadFromDefault)
    const customPath = process.env.KUBE_CONFIG_PATH
    if (customPath) {
      kc.loadFromFile(customPath)
    } else {
      kc.loadFromDefault() // reads KUBECONFIG env var or ~/.kube/config
    }
    g.__kubeConfig = kc
  }
  return g.__kubeConfig as k8s.KubeConfig
}

export function getCoreV1Api(): k8s.CoreV1Api {
  return getKubeConfig().makeApiClient(k8s.CoreV1Api)
}

export function getPortForwarder(): k8s.PortForward {
  return new k8s.PortForward(getKubeConfig())
}

export function getLocalIp(): string {
  const ifaces = os.networkInterfaces()
  // First pass: prefer private LAN ranges (192.168.x, 10.x, 172.16-31.x)
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal &&
          /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(iface.address)) {
        return iface.address
      }
    }
  }
  // Second pass: any non-internal IPv4
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return '127.0.0.1'
}

export function getClusterInfo() {
  const kc = getKubeConfig()
  const cluster = kc.getCurrentCluster()
  const context = kc.getCurrentContext()
  return { cluster: cluster?.name ?? 'unknown', server: cluster?.server ?? '', context, localIp: getLocalIp() }
}
