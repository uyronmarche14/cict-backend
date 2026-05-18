import { body, param } from 'express-validator';
import { UserRole } from '../types';

const forbiddenGeneralUserFields = ['role', 'customRole', 'customRoleId', 'isActive'];

export const createUserValidator = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),

  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),

  body('role')
    .optional()
    .isIn(Object.values(UserRole))
    .withMessage('Invalid user role'),

  body('customRoleId')
    .optional({ nullable: true })
    .isMongoId()
    .withMessage('customRoleId must be a valid role ID'),

  body('organizationAssignments')
    .optional()
    .isArray()
    .withMessage('organizationAssignments must be an array'),

  body('organizationAssignments.*.organizationId')
    .optional()
    .isString()
    .withMessage('organizationAssignments organizationId must be a string'),

  body('organizationAssignments.*.roleId')
    .optional()
    .isMongoId()
    .withMessage('organizationAssignments roleId must be a valid custom role ID'),
];

export const updateUserValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid user ID'),

  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),

  ...forbiddenGeneralUserFields.map((fieldName) =>
    body(fieldName)
      .not()
      .exists()
      .withMessage(`${fieldName} must be changed via a dedicated endpoint`)
  ),
];

export const updateUserRoleValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid user ID'),

  body('role')
    .optional()
    .isIn(Object.values(UserRole))
    .withMessage('Invalid user role'),

  body('customRoleId')
    .optional({ nullable: true })
    .custom((value) => value === null || /^[0-9a-fA-F]{24}$/.test(String(value)))
    .withMessage('customRoleId must be a valid role ID or null'),
];

export const updateUserStatusValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid user ID'),

  body('isActive')
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];
