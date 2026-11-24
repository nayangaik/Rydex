export function getHealth(_req, res) {
  res.json({ status: 'ok', service: 'vendor-service', ts: new Date().toISOString() })
}
