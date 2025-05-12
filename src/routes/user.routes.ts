import express from 'express'
import { authenticateJWT, authorizeAdmin } from '../middlewares/auth';
import { getCurrentUser, getAllUsers, getUserById, updateUserProfile, deleteUser } from '../controllers/user.controller';

const router = express.Router();

// Get current user's profile
router.get('/me', authenticateJWT as any, getCurrentUser);

// Admin-only routes
router.get('/', authenticateJWT as any, authorizeAdmin as any, getAllUsers);
router.get('/:id', authenticateJWT as any, authorizeAdmin as any, getUserById);
router.put('/:id', authenticateJWT as any, updateUserProfile);
router.delete('/:id', authenticateJWT as any, authorizeAdmin as any, deleteUser);

export default router;
