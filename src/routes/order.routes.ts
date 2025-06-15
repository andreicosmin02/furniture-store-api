import express from 'express';
import { authenticateJWT } from '../middlewares/auth';
import {
    createOrder,
    getOrderById,
    getUserOrders,
    updateOrderStatus,
    updateProductDeliveryStatus,
    getAllOrders,
    getOrderItemImage
} from '../controllers/order.controller';


const router = express.Router();

// User routes
router.post('/', authenticateJWT as any, createOrder);
router.get('/my-orders', authenticateJWT as any, getUserOrders);
router.get('/:id', authenticateJWT as any, getOrderById);
router.get('/all', authenticateJWT as any, getAllOrders);
router.get('/:orderId/item/:itemId/image', authenticateJWT as any, getOrderItemImage);

// Admin routes
router.patch('/:id/status', authenticateJWT as any, updateOrderStatus);
router.patch('/:orderId/products/:productId/status', authenticateJWT as any, updateProductDeliveryStatus);

export default router;