import multer from 'multer'

/**
 * Global Express error handler — must be mounted last.
 * @type {import('express').ErrorRequestHandler}
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, _req, res, _next) {
  console.error('[vendor-service]', error)
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large' })
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON request body' })
  }
  if (error instanceof multer.MulterError) {
    return res
      .status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
      .json({ message: error.message })
  }
  if (error.message === 'Documents must be JPEG, PNG, WebP, or PDF files') {
    return res.status(400).json({ message: error.message })
  }
  if (error.code === 'P2002') {
    return res.status(409).json({ message: 'A record with this value already exists' })
  }
  if (error.code === 'P2025') {
    return res.status(404).json({ message: 'Requested vendor record was not found' })
  }
  res.status(500).json({ message: 'Vendor service request failed' })
}
