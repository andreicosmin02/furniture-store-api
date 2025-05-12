import express from 'express';
import { register, login, registerCustomer } from '../controllers/auth.controller';
import { authenticateJWT, authorizeAdmin } from '../middlewares/auth';

const router = express.Router();

// Public routes
router.post('/login', login);
router.post('/register/customer', registerCustomer);


// Admin-protected routes (protected by middleware)
router.post('/register', authenticateJWT as any, authorizeAdmin as any, register);

export default router;