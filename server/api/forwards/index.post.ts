import { createForward } from '../../utils/forwarder'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { namespace, resourceType, resourceName, localPort, remotePort } = body

  if (!namespace || !resourceType || !resourceName || !localPort || !remotePort) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }

  if (!['pod', 'service'].includes(resourceType)) {
    throw createError({ statusCode: 400, message: 'resourceType must be "pod" or "service"' })
  }

  const lp = Number(localPort)
  const rp = Number(remotePort)

  if (isNaN(lp) || lp < 1 || lp > 65535) {
    throw createError({ statusCode: 400, message: 'Invalid localPort' })
  }
  if (isNaN(rp) || rp < 1 || rp > 65535) {
    throw createError({ statusCode: 400, message: 'Invalid remotePort' })
  }

  try {
    const forward = await createForward({
      namespace,
      resourceType,
      resourceName,
      localPort: lp,
      remotePort: rp,
    })
    return forward
  } catch (err: any) {
    throw createError({ statusCode: 500, message: err.message })
  }
})
