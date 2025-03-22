import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Extend Express Request type to incluse user
declare global {
    namespace Express {
        interface Request {
            user?: any; // Can refine this type later
        }
    }
}

// Verify JWT and attach user to request
export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1]; // Extract token

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = decoded; // Attach user data to request
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Restrict routes to admin only
export const authorizeAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
};

