import { Request, Response } from 'express';
import Role from '../models/Role';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

/**
 * Create new role
 */
export const createRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }
    
    const { name, description, permissions } = req.body;
    
    const role = await Role.create({
      name,
      description,
      permissions: permissions || [],
      createdBy: req.user.userId,
    });
    
    logger.info(`Role created: ${role._id} by user ${req.user.userId}`);
    
    res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: { role },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Get all roles
 */
export const getAllRoles = async (_req: Request, res: Response): Promise<void> => {
  try {
    const roles = await Role.find()
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: { roles },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Get role by ID
 */
export const getRoleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const role = await Role.findById(id).populate('createdBy', 'firstName lastName email');
    
    if (!role) {
      throw new AppError('Role not found', 404);
    }
    
    res.status(200).json({
      success: true,
      data: { role },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Update role
 */
export const updateRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, permissions } = req.body;
    
    const role = await Role.findById(id);
    
    if (!role) {
      throw new AppError('Role not found', 404);
    }
    
    // Prevent updating system roles
    if (role.isSystemRole) {
      throw new AppError('Cannot update system roles', 403);
    }
    
    const updates: any = {};
    if (name) updates.name = name;
    if (description) updates.description = description;
    if (permissions) updates.permissions = permissions;
    
    const updatedRole = await Role.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName email');
    
    logger.info(`Role updated: ${id} by user ${req.user?.userId}`);
    
    res.status(200).json({
      success: true,
      message: 'Role updated successfully',
      data: { role: updatedRole },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Delete role
 */
export const deleteRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const role = await Role.findById(id);
    
    if (!role) {
      throw new AppError('Role not found', 404);
    }
    
    // Prevent deleting system roles
    if (role.isSystemRole) {
      throw new AppError('Cannot delete system roles', 403);
    }
    
    await role.deleteOne();
    
    logger.info(`Role deleted: ${id} by user ${req.user?.userId}`);
    
    res.status(200).json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    throw error;
  }
};
