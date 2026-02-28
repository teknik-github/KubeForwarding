import { getCoreV1Api } from '../utils/k8s'

export interface ResourcePort {
  port: number
  name?: string
}

export interface Resource {
  name: string
  ports: ResourcePort[]
}

export default defineEventHandler(async (event): Promise<Resource[]> => {
  const query = getQuery(event)
  const namespace = (query.namespace as string) || 'default'
  const type = (query.type as string) || 'pod'
  const api = getCoreV1Api()

  if (type === 'service') {
    const result = await api.listNamespacedService(namespace)
    return result.body.items
      .filter((svc: any) => svc.metadata?.name)
      .map((svc: any) => ({
        name: svc.metadata.name as string,
        ports: (svc.spec?.ports ?? []).map((p: any) => ({
          port: p.port as number,
          name: p.name as string | undefined,
        })),
      }))
  }

  // Pods — only running ones
  const result = await api.listNamespacedPod(namespace)
  return result.body.items
    .filter((pod: any) => pod.status?.phase === 'Running' && pod.metadata?.name)
    .map((pod: any) => ({
      name: pod.metadata.name as string,
      ports: (pod.spec?.containers ?? []).flatMap((c: any) =>
        (c.ports ?? []).map((p: any) => ({
          port: p.containerPort as number,
          name: p.name as string | undefined,
        })),
      ),
    }))
})
