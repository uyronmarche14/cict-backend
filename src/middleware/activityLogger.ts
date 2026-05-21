import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import ActivityLog from '../models/ActivityLog';
import logger from '../utils/logger';

/**
 * Middleware to log admin activities
 */
export const logActivity = (action: string, resource: string) => {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Store original send function
      const originalSend = res.send;
      
      // Override send function to log after response
      res.send = function (data: any): Response {
        // Only log if request was successful (2xx status)
        if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
          const resourceId = req.params.id || req.body?.id || undefined;
          
          // Log activity asynchronously
          ActivityLog.create({
            user: req.user.userId,
            action,
            resource,
            resourceId,
            details: {
              method: req.method,
              path: req.path,
              body: sanitizeBody(req.body),
              query: req.query,
            },
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.get('user-agent'),
          }).catch((error) => {
            logger.error('Failed to log activity:', error);
          });
        }
        
        // Call original send
        return originalSend.call(this, data);
      };
      
      next();
    } catch (error) {
      logger.error('Activity logging middleware error:', error);
      next(); // Don't block request if logging fails
    }
  };
};

/**
 * Sanitize request body to remove sensitive information
 */
const sanitizeBody = (body: any): any => {
  if (!body) {return body;}
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
};
