import { body, param } from 'express-validator';

export const createProgramValidator = [
  body('code').trim().notEmpty().withMessage('Program code is required'),
  body('name').trim().notEmpty().withMessage('Program name is required'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('sortOrder').optional().isInt().withMessage('sortOrder must be an integer'),
];

export const updateProgramValidator = [
  param('id').isMongoId().withMessage('Invalid program ID'),
  body('code').optional().trim().notEmpty().withMessage('Program code cannot be empty'),
  body('name').optional().trim().notEmpty().withMessage('Program name cannot be empty'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('sortOrder').optional().isInt().withMessage('sortOrder must be an integer'),
];

export const createYearLevelValidator = [
  body('code').trim().notEmpty().withMessage('Year level code is required'),
  body('label').trim().notEmpty().withMessage('Year level label is required'),
  body('numericLevel').isInt({ min: 1 }).withMessage('numericLevel must be a positive integer'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('sortOrder').optional().isInt().withMessage('sortOrder must be an integer'),
];

export const updateYearLevelValidator = [
  param('id').isMongoId().withMessage('Invalid year level ID'),
  body('code').optional().trim().notEmpty().withMessage('Year level code cannot be empty'),
  body('label').optional().trim().notEmpty().withMessage('Year level label cannot be empty'),
  body('numericLevel').optional().isInt({ min: 1 }).withMessage('numericLevel must be positive'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('sortOrder').optional().isInt().withMessage('sortOrder must be an integer'),
];

export const createSectionValidator = [
  body('programId').isMongoId().withMessage('programId must be a valid ID'),
  body('yearLevelId').isMongoId().withMessage('yearLevelId must be a valid ID'),
  body('name').trim().notEmpty().withMessage('Section name is required'),
  body('displayName').trim().notEmpty().withMessage('displayName is required'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

export const updateSectionValidator = [
  param('id').isMongoId().withMessage('Invalid section ID'),
  body('programId').optional().isMongoId().withMessage('programId must be a valid ID'),
  body('yearLevelId').optional().isMongoId().withMessage('yearLevelId must be a valid ID'),
  body('name').optional().trim().notEmpty().withMessage('Section name cannot be empty'),
  body('displayName').optional().trim().notEmpty().withMessage('displayName cannot be empty'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];
