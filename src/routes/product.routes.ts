import express from 'express';
import { authenticateJWT, authorizeAdmin } from '../middlewares/auth';
import {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    updateStock
} from '../controllers/product.controller';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Public routes
router.get('/', getAllProducts);
router.get('/:id', getProductById);

// Admin protected routes
router.post('/', authenticateJWT as any, authorizeAdmin as any, upload.single('image'), createProduct as any);
router.put('/:id', authenticateJWT as any, authorizeAdmin as any, upload.single('image'), updateProduct);
router.delete('/:id', authenticateJWT as any, authorizeAdmin as any, deleteProduct);
router.patch('/:id/stock', authenticateJWT as any, authorizeAdmin as any, updateStock);

export default router;