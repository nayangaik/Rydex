

export const getHealth = (_req, res) => res.json({ status: 'ok', service: 'user-service', ts: new Date().toISOString() })
