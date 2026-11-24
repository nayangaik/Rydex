import { Router } from 'express'
import express from 'express'
import upload from '../middleware/upload.js'
import { internal } from '../middleware/internal.js'
import { adminOnly } from '../middleware/roles.js'
import { getMyProfile, updateMyProfile, updateMyProfilePhoto, createAccountRequest, listUserAccounts, getUserAccount, updateUserAccountStatus, resolveAccountRequest, getUserAuditEvents } from '../controllers/user.controller.js'

const router = Router()

router.use('/api/users', internal)

router.get('/api/users/me', express.json(), getMyProfile)
router.put('/api/users/me/profile', express.json({ limit: '1mb' }), updateMyProfile)
router.post('/api/users/me/photo', upload.single('photo'), updateMyProfilePhoto)
router.post('/api/users/me/requests', express.json(), createAccountRequest)
router.get('/api/users', adminOnly, listUserAccounts)
router.get('/api/users/:userId', adminOnly, getUserAccount)
router.patch('/api/users/:userId/status', adminOnly, express.json(), updateUserAccountStatus)
router.patch('/api/users/requests/:requestId', adminOnly, express.json(), resolveAccountRequest)
router.get('/api/users/:userId/audit', adminOnly, getUserAuditEvents)

export default router
