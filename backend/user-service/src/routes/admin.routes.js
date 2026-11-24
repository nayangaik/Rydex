import { Router } from 'express'
import express from 'express'
import { internal } from '../middleware/internal.js'
import { adminOnly } from '../middleware/roles.js'
import { getAdminDashboard, getAdminEarnings, getAdminVendor, approveAdminVendor, rejectAdminVendor, getAdminVehicle, approveAdminVehicle, rejectAdminVehicle, getPendingVideoKyc, startVideoKyc, completeVideoKyc } from '../controllers/admin.controller.js'

const router = Router()

router.use('/api/admin', express.json({ limit: '1mb' }))
router.use('/api/admin', internal)

router.get('/api/admin/dashboard', adminOnly, getAdminDashboard)
router.get('/api/admin/earnings', adminOnly, getAdminEarnings)
router.get('/api/admin/vendors/:id', adminOnly, getAdminVendor)
router.post('/api/admin/vendors/:id/approve', adminOnly, approveAdminVendor)
router.post('/api/admin/vendors/:id/reject', adminOnly, express.json(), rejectAdminVendor)
router.get('/api/admin/vehicles/:id', adminOnly, getAdminVehicle)
router.post('/api/admin/vehicles/:id/approve', adminOnly, approveAdminVehicle)
router.post('/api/admin/vehicles/:id/reject', adminOnly, express.json(), rejectAdminVehicle)
router.get('/api/admin/vendors/video-kyc/pending', adminOnly, getPendingVideoKyc)
router.post('/api/admin/vendors/video-kyc/start/:vendorId', adminOnly, express.json(), startVideoKyc)
router.post('/api/admin/vendors/video-kyc/complete', adminOnly, express.json(), completeVideoKyc)

export default router
