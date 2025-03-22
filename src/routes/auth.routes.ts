import express from 'express';
import { register, login } from '../controllers/auth.controller';
import { authenticateJWT, authorizeAdmin } from '../middlewares/auth';

const router = express.Router();

// Public route
router.post('/login', login);

// Admin-only route (protected by middleware)
router.post('/register', authenticateJWT as any, authorizeAdmin as any, register);

export default router;