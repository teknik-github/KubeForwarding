import { listForwards } from '../../utils/forwarder'

export default defineEventHandler(() => {
  return listForwards()
})
