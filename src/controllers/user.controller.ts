import { Request, Response } from 'express';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

/**
 * Get all users (members)
 */
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, role, isActive } = req.query;
    
    const query: any = {};
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    
    if (role) {
      query.role = role;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .populate('customRole', 'name description')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(query),
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id)
      .select('-password')
      .populate('customRole', 'name description permissions');
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Update user
 */
export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { firstName, lastName, role, customRole, isActive } = req.body;
    
    const updates: any = {};
    
    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;
    if (role) updates.role = role;
    if (customRole !== undefined) updates.customRole = customRole;
    if (isActive !== undefined) updates.isActive = isActive;
    
    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .select('-password')
      .populate('customRole', 'name description permissions');
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    logger.info(`User updated: ${id} by user ${req.user?.userId}`);
    
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: { user },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Delete user
 */
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Prevent self-deletion
    if (req.user?.userId === id) {
      throw new AppError('You cannot delete your own account', 400);
    }
    
    const user = await User.findByIdAndDelete(id);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    logger.info(`User deleted: ${id} by user ${req.user?.userId}`);
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Assign role to user
 */
export const assignRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, customRole } = req.body;
    
    const updates: any = {};
    if (role) updates.role = role;
    if (customRole !== undefined) updates.customRole = customRole;
    
    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .select('-password')
      .populate('customRole', 'name description permissions');
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    logger.info(`Role assigned to user: ${id} by user ${req.user?.userId}`);
    
    res.status(200).json({
      success: true,
      message: 'Role assigned successfully',
      data: { user },
    });
  } catch (error) {
    throw error;
  }
};
