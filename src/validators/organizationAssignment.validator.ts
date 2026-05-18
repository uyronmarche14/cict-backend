import { body, param } from 'express-validator';

export const createOrganizationAssignmentValidator = [
  param('id').isMongoId().withMessage('Invalid user ID'),
  body('organizationId')
    .trim()
    .notEmpty()
    .withMessage('organizationId is required'),
  body('roleId')
    .isMongoId()
    .withMessage('roleId must be a valid custom role ID'),
];

export const updateOrganizationAssignmentValidator = [
  param('id').isMongoId().withMessage('Invalid user ID'),
  param('assignmentId').isMongoId().withMessage('Invalid assignment ID'),
  body('organizationId')
    .trim()
    .notEmpty()
    .withMessage('organizationId is required'),
  body('roleId')
    .isMongoId()
    .withMessage('roleId must be a valid custom role ID'),
];

export const deleteOrganizationAssignmentValidator = [
  param('id').isMongoId().withMessage('Invalid user ID'),
  param('assignmentId').isMongoId().withMessage('Invalid assignment ID'),
];

export const getOrganizationAssignmentsValidator = [
  param('id').isMongoId().withMessage('Invalid user ID'),
];
