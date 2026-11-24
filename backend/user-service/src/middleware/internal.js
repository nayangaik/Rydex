export function internal(req, res, next) {
  const expected = process.env.INTERNAL_SERVICE_TOKEN
  if (!expected || req.get('x-internal-service-token') !== expected) {
    return res.status(401).json({ error: 'Unauthorized service request' })
  }

  const userId = req.get('x-user-id')
  const role = req.get('x-user-role')
  if (!userId || !role) return res.status(401).json({ error: 'User identity required' })

  req.actor = { userId, role }
  next()
}
