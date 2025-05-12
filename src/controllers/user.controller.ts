import { Request, Response } from 'express';
import User from '../models/User';
import { error } from 'console';

// Get current user's profile
export const getCurrentUser = async (req: Request, res: Response): Promise<any> => {
    try {
        const user = await User.findById(req.user.userId)
            .select('-password -__v');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
    } catch(error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Get all users (admin only)
export const getAllUsers = async (req: Request, res: Response): Promise<any> => {
    try {
        const users = await User.find()
            .select('-password -__v')
            .sort({ createdAt: -1 });

        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Get user by ID (admin only)
export const getUserById = async (req: Request, res: Response): Promise<any> => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password -__v');
        
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Update user profile
export const updateUserProfile = async (req:Request, res: Response): Promise<any> => {
    try {
        const { firstName, lastName, email } = req.body;
        const userId = req.params.id;

        // Verify ownership or admin status
        if (req.user.role !== 'admin' && req.user.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { firstName, lastName, email },
            { new: true, runValidators: true }
        ).select('-password -__v');

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' })
        }

        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ error: 'Update failed' });
    }
};

// Delete user (admin only)
export const deleteUser = async (req: Request, res: Response): Promise<any> => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Deletion failed' });
    }
};