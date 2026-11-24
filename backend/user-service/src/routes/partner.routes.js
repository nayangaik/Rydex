import { Router } from 'express'
import express from 'express'
import upload from '../middleware/upload.js'
import { internal } from '../middleware/internal.js'
import { getPartnerProfile, getPartnerReview, resubmitPartnerApplication, getPartnerVehicle, upsertPartnerVehicle, getPartnerVehiclePricing, submitPartnerVehiclePricing, updatePartnerVehiclePricing, getPartnerDocuments, savePartnerDocuments, getPartnerBank, savePartnerBank, getPartnerEarnings } from '../controllers/partner.controller.js'

const router = Router()

router.use('/api/partner', express.json({ limit: '1mb' }))
router.use('/api/partner', internal)

router.get('/api/partner/me', getPartnerProfile)
router.get('/api/partner/review', getPartnerReview)
router.post('/api/partner/resubmit', resubmitPartnerApplication)
router.get('/api/partner/vehicle', getPartnerVehicle)
router.post('/api/partner/vehicle', express.json(), upsertPartnerVehicle)
router.get('/api/partner/vehicle/pricing', getPartnerVehiclePricing)
router.post('/api/partner/vehicle/pricing', upload.single('image'), submitPartnerVehiclePricing)
router.patch('/api/partner/vehicle/pricing', upload.single('image'), updatePartnerVehiclePricing)
router.get('/api/partner/documents', getPartnerDocuments)
router.post('/api/partner/documents', upload.fields([{ name: 'aadhaar', maxCount: 1 }, { name: 'license', maxCount: 1 }, { name: 'rc', maxCount: 1 }]), savePartnerDocuments)
router.get('/api/partner/bank', getPartnerBank)
router.post('/api/partner/bank', express.json(), savePartnerBank)
router.get('/api/partner/earnings', getPartnerEarnings)

export default router
