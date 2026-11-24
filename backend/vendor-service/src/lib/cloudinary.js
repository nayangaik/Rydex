import { v2 as cloudinary } from 'cloudinary'
import { Readable } from 'node:stream'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/**
 * Upload a buffer to Cloudinary.
 * @param {Buffer} buffer
 * @param {string} folder
 * @param {string} mimetype
 * @returns {Promise<string>} secure_url
 */
export function uploadBuffer(buffer, folder, mimetype) {
  return new Promise((resolve, reject) => {
    const resourceType = mimetype === 'application/pdf' ? 'raw' : 'image'
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error || !result) return reject(error || new Error('Upload failed'))
        resolve(result.secure_url)
      }
    )
    Readable.from(buffer).pipe(stream)
  })
}

/**
 * Upload a multer file object if it has content, otherwise return null.
 * @param {{ buffer: Buffer, size: number, mimetype: string } | undefined} file
 * @param {string} folder
 * @returns {Promise<string | null>}
 */
export async function imageUrl(file, folder) {
  return file?.size ? uploadBuffer(file.buffer, folder, file.mimetype) : null
}

export default cloudinary
