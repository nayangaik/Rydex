/**
 * Restrict access to admin users only.
 */
export const adminOnly = (req, res, next) =>
  req.actor.role === 'admin'
    ? next()
    : res.status(403).json({ error: 'Admin access required' })

/**
 * Restrict access to vendor/partner users only.
 */
export const vendorOnly = (req, res, next) =>
  ['vendor', 'partner'].includes(req.actor.role)
    ? next()
    : res.status(403).json({ error: 'Vendor access required' })
