import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import {
  createAuthLoginRateLimiter,
  createAuthSessionRateLimiter,
} from '../middleware/rateLimiters';
import { requireAdminAccess } from '../middleware/permissions';
import { validate } from '../middleware/validate';
import { 
  loginValidator, 
  updatePasswordValidator 
} from '../validators/auth.validator';

const router: Router = Router();

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  createAuthLoginRateLimiter(),
  validate(loginValidator),
  authController.login
);

router.post('/logout', createAuthSessionRateLimiter(), authController.logout);

router.get(
  '/permission-metadata',
  authenticate,
  requireAdminAccess,
  authController.getPermissionMetadata
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/profile',
  createAuthSessionRateLimiter(),
  authenticate,
  authController.getProfile
);

/**
 * @route   PUT /api/auth/password
 * @desc    Update password
 * @access  Private
 */
router.put(
  '/password',
  authenticate,
  validate(updatePasswordValidator),
  authController.updatePassword
);

export default router;
