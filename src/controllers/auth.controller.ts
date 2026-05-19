import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { IJWTPayload } from '../types';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { AuthRequest } from '../middleware/auth';
import { buildAuthenticatedUser, serializeAuthUser } from '../utils/rbac';
import { getAuthCookieOptions } from '../utils/authCookies';
import { getPermissionMetadata as getPermissionMetadataCatalog } from '../utils/permissionMetadata';

/**
 * Generate JWT token
 */
const generateToken = (payload: IJWTPayload): string => {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtExpire = process.env.JWT_EXPIRE || '7d';
  
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined');
  }
  
  // Convert payload to plain object for jwt.sign
  const plainPayload = {
    userId: payload.userId.toString(),
    email: payload.email,
    role: payload.role,
    customRole: payload.customRole ? payload.customRole.toString() : undefined,
  };
  
  return jwt.sign(plainPayload, jwtSecret as jwt.Secret, { expiresIn: jwtExpire } as jwt.SignOptions);
};

/**
 * Login user
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }
    
    // Check if user is active
    if (!user.isActive) {
      throw new AppError('Your account has been deactivated', 403);
    }
    
    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Generate token
    const tokenPayload: IJWTPayload = {
      userId: user._id as unknown as string, // Cast to string for payload
      email: user.email,
      role: user.role,
      customRole: user.customRole as unknown as string, // Cast to string for payload
    };
    
    const token = generateToken(tokenPayload);
    const authenticatedUser = await buildAuthenticatedUser(user);
    const serializedUser = await serializeAuthUser(authenticatedUser);

    res.cookie('token', token, getAuthCookieOptions());
    
    logger.info(`User logged in: ${user.email}`);
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: serializedUser,
        permissions: authenticatedUser.permissions,
        canAccessAdmin: authenticatedUser.canAccessAdmin,
        adminScopes: authenticatedUser.adminScopes,
        visibleAdminModules: authenticatedUser.visibleAdminModules,
        scopedAdminModulesByOrganization:
          authenticatedUser.scopedAdminModulesByOrganization,
      },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Logout user
 */
export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie('token', {
    ...getAuthCookieOptions(),
    maxAge: undefined,
  });

  res.status(200).json({
    success: true,
    message: 'Logout successful',
  });
};

/**
 * Get current user profile
 */
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }
    const serializedUser = await serializeAuthUser(req.user);
    
    res.status(200).json({
      success: true,
      data: {
        user: serializedUser,
        permissions: req.user.permissions,
        canAccessAdmin: req.user.canAccessAdmin,
        adminScopes: req.user.adminScopes,
        visibleAdminModules: req.user.visibleAdminModules,
        scopedAdminModulesByOrganization: req.user.scopedAdminModulesByOrganization,
      },
    });
  } catch (error) {
    throw error;
  }
};

export const getPermissionMetadata = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    data: {
      permissions: getPermissionMetadataCatalog(),
    },
  });
};

/**
 * Update password
 */
export const updatePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }
    
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.userId).select('+password');
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isPasswordValid) {
      throw new AppError('Current password is incorrect', 401);
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    logger.info(`Password updated for user: ${user.email}`);
    
    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    throw error;
  }
};
