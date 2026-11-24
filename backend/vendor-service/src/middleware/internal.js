/**
 * Internal service authentication middleware.
 * Verifies x-internal-service-token, x-user-id, and x-user-role headers.
 */
export function internal(req, res, next) {
  if (
    !process.env.INTERNAL_SERVICE_TOKEN ||
    req.get('x-internal-service-token') !== process.env.INTERNAL_SERVICE_TOKEN
  ) {
    return res.status(401).json({ error: 'Unauthorized service request' })
  }
  const userId = req.get('x-user-id')
  const role = req.get('x-user-role')
  if (!userId || !role) return res.status(401).json({ error: 'User identity required' })
  req.actor = { userId, role }
  next()
}
