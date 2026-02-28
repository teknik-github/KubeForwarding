import { getClusterInfo } from '../utils/k8s'

export default defineEventHandler(() => {
  return getClusterInfo()
})
