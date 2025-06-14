import express from 'express';
import { authenticateJWT } from '../middlewares/auth';
import { analyzeFurniturePlacement, generateFurnitureOnlyImage, generateFurnitureInRoomImage, analyzeRoomWithProducts, generateRoomImage } from '../controllers/ai.controller';

const router = express.Router();

router.post(
  '/analyze-furniture', 
  authenticateJWT as any, 
  analyzeFurniturePlacement as any
);
router.post('/generate/furniture-only', authenticateJWT as any, generateFurnitureOnlyImage as any);
router.post('/generate/in-room', authenticateJWT as any, generateFurnitureInRoomImage as any);

router.post('/generate/room-with-products', authenticateJWT as any, generateRoomImage as any);
router.post('/analyze/room-with-products', authenticateJWT as any, analyzeRoomWithProducts as any);



export default router;