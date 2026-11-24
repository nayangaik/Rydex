import multer from 'multer'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, done) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype)) {
      return done(new Error('Documents must be JPEG, PNG, WebP, or PDF files'))
    }
    done(null, true)
  },
})

export default upload
