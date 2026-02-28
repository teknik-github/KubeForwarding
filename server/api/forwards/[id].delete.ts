import { stopForward } from '../../utils/forwarder'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')!
  const stopped = stopForward(id)
  if (!stopped) {
    throw createError({ statusCode: 404, message: 'Forward not found' })
  }
  return { success: true }
})
