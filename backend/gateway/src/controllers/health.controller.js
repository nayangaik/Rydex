export function getHealth(_req, res) {
  res.json({ status: 'ok', service: 'gateway', ts: new Date().toISOString() })
}
