import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { IJWTPayload } from '../types';
import logger from '../utils/logger';

// Extend Express Request type
export interface AuthRequest extends Request {
  user?: IJWTPayload;
}

/**
 * Middleware to verify JWT token and attach user to request
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided. Authorization denied.',
      });
      return;
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET is not defined in environment variables');
      res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
      return;
    }
    
    const decoded = jwt.verify(token, jwtSecret) as IJWTPayload;
    
    // Attach user to request
    req.user = decoded;
    
    next();
  } catch (error: any) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Token has expired',
      });
      return;
    }
    
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
    });
  }
};

/**
 * Middleware to optionally verify JWT token and attach user to request if valid
 * Does NOT fail if no token or invalid token
 */
export const optionalAuthenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Prevent unused variable error
  void res;
  
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const jwtSecret = process.env.JWT_SECRET;
      
      if (jwtSecret) {
        try {
          const decoded = jwt.verify(token, jwtSecret) as IJWTPayload;
          req.user = decoded;
        } catch (err) {
          // Token invalid or expired, proceed as unauthenticated
        }
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
};
