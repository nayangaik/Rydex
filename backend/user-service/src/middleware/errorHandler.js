import multer from 'multer'

export function errorHandler(error, _req, res, _next) {
  console.error('[user-service]', error)
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' })
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON request body' })
  }
  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    return res.status(status).json({
      error: error.code === 'LIMIT_FILE_SIZE' ? 'Profile photos must be 5 MB or smaller' : error.message,
    })
  }
  if (error.message === 'Only JPEG, PNG, and WebP images are supported') {
    return res.status(400).json({ error: error.message })
  }
  res.status(500).json({ error: 'User service request failed' })
}
