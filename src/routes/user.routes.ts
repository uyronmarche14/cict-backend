import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/permissions';
import { logActivity } from '../middleware/activityLogger';
import { Permission } from '../types';
import { validate } from '../middleware/validate';
import {
  createOrganizationAssignmentValidator,
  deleteOrganizationAssignmentValidator,
  getOrganizationAssignmentsValidator,
  updateOrganizationAssignmentValidator,
} from '../validators/organizationAssignment.validator';
import {
  createUserValidator as baseCreateUserValidator,
  updateUserRoleValidator,
  updateUserStatusValidator,
  updateUserValidator,
} from '../validators/user.validator';

const router: Router = Router();

/**
 * @route   POST /api/users
 * @desc    Create new admin CMS user
 * @access  Private (requires CREATE_USER permission)
 */
router.post(
  '/',
  authenticate,
  authorize(Permission.CREATE_USER),
  validate(baseCreateUserValidator),
  logActivity('create', 'user'),
  userController.createUser
);

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Private (requires VIEW_USERS permission)
 */
router.get(
  '/',
  authenticate,
  authorize(Permission.VIEW_USERS),
  userController.getAllUsers
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private (requires VIEW_USERS permission)
 */
router.get(
  '/:id',
  authenticate,
  authorize(Permission.VIEW_USERS),
  userController.getUserById
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private (requires EDIT_USER permission)
 */
router.put(
  '/:id',
  authenticate,
  authorize(Permission.EDIT_USER),
  validate(updateUserValidator),
  logActivity('update', 'user'),
  userController.updateUser
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Private (requires DELETE_USER permission)
 */
router.delete(
  '/:id',
  authenticate,
  authorize(Permission.DELETE_USER),
  logActivity('delete', 'user'),
  userController.deleteUser
);

/**
 * @route   PATCH /api/users/:id/role
 * @desc    Assign role to user
 * @access  Private (requires ASSIGN_ROLE permission)
 */
router.patch(
  '/:id/role',
  authenticate,
  authorize(Permission.ASSIGN_ROLE),
  validate(updateUserRoleValidator),
  logActivity('assign_role', 'user'),
  userController.updateUserRole
);

/**
 * @route   PATCH /api/users/:id/status
 * @desc    Update user status
 * @access  Private (requires SET_USER_STATUS permission)
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize(Permission.SET_USER_STATUS),
  validate(updateUserStatusValidator),
  logActivity('set_status', 'user'),
  userController.updateUserStatus
);

router.get(
  '/:id/org-assignments',
  authenticate,
  authorize(Permission.ASSIGN_ROLE),
  validate(getOrganizationAssignmentsValidator),
  userController.getUserOrgAssignments
);

router.post(
  '/:id/org-assignments',
  authenticate,
  authorize(Permission.ASSIGN_ROLE),
  validate(createOrganizationAssignmentValidator),
  logActivity('assign_org_role', 'user'),
  userController.createUserOrgAssignment
);

router.put(
  '/:id/org-assignments/:assignmentId',
  authenticate,
  authorize(Permission.ASSIGN_ROLE),
  validate(updateOrganizationAssignmentValidator),
  logActivity('update_org_role', 'user'),
  userController.updateUserOrgAssignment
);

router.delete(
  '/:id/org-assignments/:assignmentId',
  authenticate,
  authorize(Permission.ASSIGN_ROLE),
  validate(deleteOrganizationAssignmentValidator),
  logActivity('remove_org_role', 'user'),
  userController.deleteUserOrgAssignment
);

export default router;
