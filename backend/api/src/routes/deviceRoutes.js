import express from 'express';
import { registerDeviceToken } from '../controllers/deviceController.js';
import { authenticate } from '../middleware/auth.js';
import { userLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// POST /api/devices/register
router.post('/register', authenticate, userLimiter, registerDeviceToken);

export default router;