import { Router } from 'express'
import { adminOnly } from '../middleware/roles.js'
import {
  getVendor, approveVendor, rejectVendor, getVideoKycPending, startVideoKyc,
  completeVideoKyc, getVehicle, approveVehicle, rejectVehicle,
} from '../controllers/admin.controller.js'

const router = Router()

router.use(adminOnly)
router.get('/vendors/video-kyc/pending', getVideoKycPending)
router.patch('/vendors/video-kyc/start/:vendorId', startVideoKyc)
router.patch('/vendors/video-kyc/complete', completeVideoKyc)
router.get('/vendors/:id', getVendor)
router.post('/vendors/:id/approve', approveVendor)
router.post('/vendors/:id/reject', rejectVendor)
router.get('/vehicles/:id', getVehicle)
router.post('/vehicles/:id/approve', approveVehicle)
router.post('/vehicles/:id/reject', rejectVehicle)

export default router
