import { getCoreV1Api } from '../utils/k8s'

export default defineEventHandler(async () => {
  const api = getCoreV1Api()
  const result = await api.listNamespace()
  return result.body.items
    .map(ns => ns.metadata?.name)
    .filter(Boolean)
    .sort() as string[]
})
