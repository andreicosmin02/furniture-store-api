import express from 'express';
import { authenticateJWT } from '../middlewares/auth';
import { analyzeFurniturePlacement, generateFurnitureImage } from '../controllers/ai.controller';

const router = express.Router();

router.post(
  '/analyze-furniture', 
  authenticateJWT as any, 
  analyzeFurniturePlacement as any
);
router.post('/generate-image', authenticateJWT as any, generateFurnitureImage as any);


export default router;