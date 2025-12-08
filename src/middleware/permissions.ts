import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { Permission, UserRole } from '../types';
import Role from '../models/Role';
import logger from '../utils/logger';

/**
 * Middleware to check if user has required permissions
 */
export const authorize = (...requiredPermissions: Permission[]) => {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }
      
      const { role, customRole } = req.user;
      
      // Full admin has all permissions
      if (role === UserRole.FULL_ADMIN) {
        return next();
      }
      
      let userPermissions: Permission[] = [];
      
      // Get permissions from custom role if exists
      if (customRole) {
        const roleDoc = await Role.findById(customRole);
        if (roleDoc) {
          userPermissions = roleDoc.permissions;
        }
      } else {
        // Get default permissions based on system role
        userPermissions = getDefaultPermissions(role);
      }
      
      // Check if user has all required permissions
      const hasPermission = requiredPermissions.every(permission =>
        userPermissions.includes(permission)
      );
      
      if (!hasPermission) {
        logger.warn(`User ${req.user.userId} attempted unauthorized action`, {
          requiredPermissions,
          userPermissions,
        });
        
        res.status(403).json({
          success: false,
          message: 'You do not have permission to perform this action',
        });
        return;
      }
      
      next();
    } catch (error) {
      logger.error('Authorization error:', error);
      res.status(500).json({
        success: false,
        message: 'Authorization check failed',
      });
    }
  };
};

/**
 * Get default permissions for system roles
 */
const getDefaultPermissions = (role: UserRole): Permission[] => {
  switch (role) {
    case UserRole.FULL_ADMIN:
      return Object.values(Permission);
      
    case UserRole.SEMI_ADMIN:
      return [
        Permission.CREATE_NEWS,
        Permission.EDIT_NEWS,
        Permission.PUBLISH_NEWS,
        Permission.VIEW_NEWS,
        Permission.CREATE_ANNOUNCEMENT,
        Permission.EDIT_ANNOUNCEMENT,
        Permission.PUBLISH_ANNOUNCEMENT,
        Permission.VIEW_ANNOUNCEMENT,
        Permission.VIEW_MEMBER,
        Permission.EDIT_MEMBER,
      ];
      
    case UserRole.SUPPORT:
      return [
        Permission.VIEW_NEWS,
        Permission.VIEW_ANNOUNCEMENT,
        Permission.VIEW_MEMBER,
      ];
      
    default:
      return [];
  }
};

/**
 * Middleware to check if user is admin (full or semi)
 */
export const isAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }
  
  const { role } = req.user;
  
  if (role === UserRole.FULL_ADMIN || role === UserRole.SEMI_ADMIN) {
    return next();
  }
  
  res.status(403).json({
    success: false,
    message: 'Admin access required',
  });
};
