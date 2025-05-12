import express from 'express';
import { authenticateJWT } from '../middlewares/auth';
import {
    createOrder,
    getOrderById,
    getUserOrders,
    updateOrderStatus,
    updateProductDeliveryStatus,
    getAllOrders // Add this import
} from '../controllers/order.controller';


const router = express.Router();

// User routes
router.post('/', authenticateJWT as any, createOrder);
router.get('/', authenticateJWT as any, getUserOrders);
router.get('/:id', authenticateJWT as any, getOrderById);
router.get('/all', authenticateJWT as any, getAllOrders);

// Admin routes
router.patch('/:id/status', authenticateJWT as any, updateOrderStatus);
router.patch('/:orderId/products/:productId/delivery', authenticateJWT as any, updateProductDeliveryStatus);

export default router;