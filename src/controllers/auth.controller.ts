import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import dotenv from 'dotenv';
import { error } from 'console';

dotenv.config();

// Customer registrateion (Public)
export const registerCustomer = async (req: Request, res: Response): Promise<any> => {
    try {
        const { firstName, lastName, email, password }= req.body;

        // Validate required fields
        if (!firstName || !lastName) {
            return res.status(400).json({ error: 'First name and last name are required' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Create new customer
        const user = new User({
            firstName,
            lastName,
            email,
            password,
            role: 'customer'    // Force customer role
        });

        await user.save();

        res.status(201).json({
            message: 'Customer registered successfully',
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
}

// Employee/Admin registration (Admin-only)
export const register = async (req: Request, res: Response): Promise<any> => {
    try {
        const { firstName, lastName, email, password, role } = req.body;

        // Validate required fields
        if (!firstName || !lastName) {
            return res.status(400).json({ error: 'First name and last name are required' })
        }

        // Prevent creating cusotmers through this endpoint
        if (role === 'customer') {
            return res.status(403).json({ error: 'Cannot create customer accounts through this endpoint' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Create a new staff user
        const user = new User({ 
            firstName,
            lastName,
            email, 
            password, 
            role 
        });

        await user.save();

        res.status(201).json({ 
            message: 'Staff user created',
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role
            }
        });
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
            { expiresIn: '24h' }
        );

        res.json({ 
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role
            }
        });            
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
};