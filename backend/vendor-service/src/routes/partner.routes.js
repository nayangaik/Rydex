import { Router } from 'express'
import upload from '../lib/multer.js'
import { vendorOnly } from '../middleware/roles.js'
import {
  getVehicle, createVehicle, getDocuments, uploadDocuments, getBank, saveBank,
  getReview, resubmit, getVehiclePricing, submitVehiclePricing,
  editVehiclePricing, getEarnings,
} from '../controllers/partner.controller.js'

const router = Router()

router.get('/vehicle', vendorOnly, getVehicle)
// Vehicle registration starts vendor onboarding, so an authenticated user may call it.
router.post('/vehicle', createVehicle)
router.get('/documents', vendorOnly, getDocuments)
router.post('/documents', vendorOnly, upload.fields([
  { name: 'aadhaar', maxCount: 1 },
  { name: 'license', maxCount: 1 },
  { name: 'rc', maxCount: 1 },
]), uploadDocuments)
router.get('/bank', vendorOnly, getBank)
router.post('/bank', vendorOnly, saveBank)
router.get('/review', vendorOnly, getReview)
router.post('/resubmit', vendorOnly, resubmit)
router.get('/vehicle/pricing', vendorOnly, getVehiclePricing)
router.post('/vehicle/pricing', vendorOnly, upload.single('image'), submitVehiclePricing)
router.patch('/vehicle/pricing/edit', vendorOnly, upload.single('image'), editVehiclePricing)
router.get('/earnings', vendorOnly, getEarnings)

export default router
