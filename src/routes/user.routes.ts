import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/permissions';
import { logActivity } from '../middleware/activityLogger';
import { Permission } from '../types';

const router: Router = Router();

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Private (requires VIEW_MEMBER permission)
 */
router.get(
  '/',
  authenticate,
  authorize(Permission.VIEW_MEMBER),
  userController.getAllUsers
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (requires VIEW_MEMBER permission)
 */
router.get(
  '/:id',
  authenticate,
  authorize(Permission.VIEW_MEMBER),
  userController.getUserById
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private (requires EDIT_MEMBER permission)
 */
router.put(
  '/:id',
  authenticate,
  authorize(Permission.EDIT_MEMBER),
  logActivity('update', 'user'),
  userController.updateUser
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Private (requires DELETE_MEMBER permission)
 */
router.delete(
  '/:id',
  authenticate,
  authorize(Permission.DELETE_MEMBER),
  logActivity('delete', 'user'),
  userController.deleteUser
);

/**
 * @route   PATCH /api/users/:id/role
 * @desc    Assign role to user
 * @access  Private (requires MANAGE_MEMBER_ROLES permission)
 */
router.patch(
  '/:id/role',
  authenticate,
  authorize(Permission.MANAGE_MEMBER_ROLES),
  logActivity('assign_role', 'user'),
  userController.assignRole
);

export default router;
