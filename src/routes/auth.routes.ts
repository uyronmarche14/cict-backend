import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { 
  registerValidator, 
  loginValidator, 
  updatePasswordValidator 
} from '../validators/auth.validator';
import { authorize } from '../middleware/permissions';
import { Permission } from '../types';

const router: Router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register new user (admin only)
 * @access  Private (Full Admin)
 */
router.post(
  '/register',
  authenticate,
  authorize(Permission.CREATE_MEMBER),
  validate(registerValidator),
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  validate(loginValidator),
  authController.login
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/profile',
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
