import { Router } from 'express'
import { getHealth } from '../controllers/health.controller.js'

const router = Router()

router.get('/api/health', getHealth)

export default router
