import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import dotenv from 'dotenv';

dotenv.config();

// Register (Admin-only)
export const register = async (req: Request, res: Response): Promise<any> => {
    try {
        const { email, password, role } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Create a new user
        const user = new User({ email, password, role });
        await user.save();

        res.status(201).json({ message: 'User created' });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
};

// Login (Public)
export const login = async (req: Request, res: Response): Promise<any> => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET!,
            { expiresIn: '1h' }
        );

        res.json({ token });
            
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
};