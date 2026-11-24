export const adminOnly = (req, res, next) =>
  req.actor?.role === 'admin'
    ? next()
    : res.status(403).json({ error: 'Admin access required' })
