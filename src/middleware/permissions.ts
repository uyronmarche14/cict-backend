import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { Permission } from '../types';
import logger from '../utils/logger';
import { canAccessAdminPanel, hasGlobalPermission } from '../utils/rbac';

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
      
      const { permissions: userPermissions } = req.user;
      
      // Check if user has all required permissions
      const hasPermission = requiredPermissions.every((permission) =>
        hasGlobalPermission(req.user!, permission)
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

export const authorizeAny = (...allowedPermissions: Permission[]) => {
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

      const { permissions: userPermissions } = req.user;

      const hasPermission = allowedPermissions.some((permission) =>
        hasGlobalPermission(req.user!, permission)
      );

      if (!hasPermission) {
        logger.warn(`User ${req.user.userId} attempted unauthorized action`, {
          allowedPermissions,
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
export { getDefaultPermissions } from '../utils/rbac';

/**
 * Middleware to check if user can access admin features
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
  
  if (req.user.canAccessAdmin) {
    return next();
  }
  
  res.status(403).json({
    success: false,
    message: 'Admin access required',
  });
};

export const requireAdminAccess = async (
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

  if (req.user.canAccessAdmin || canAccessAdminPanel(req.user.permissions, req.user.organizationAssignments)) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    message: 'You do not have access to the admin panel',
  });
};
