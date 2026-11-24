import { Router } from 'express'
import { getHealth } from '../controllers/health.controller.js'

const router = Router()
router.get('/api/health', getHealth)
router.get('/health', getHealth)

export default router
