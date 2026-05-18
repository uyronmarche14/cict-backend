import { body, param } from 'express-validator';

const organizationBaseValidator = [
  body('id')
    .optional()
    .trim()
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Organization slug must contain only lowercase letters, numbers, and hyphens'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('Organization short name must be between 2 and 80 characters'),
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 3, max: 160 })
    .withMessage('Organization full name must be between 3 and 160 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  body('longDescription')
    .optional()
    .trim()
    .isLength({ min: 20, max: 5000 })
    .withMessage('Long description must be between 20 and 5000 characters'),
  body('logo')
    .optional()
    .isURL()
    .withMessage('Logo must be a valid URL'),
  body('banner')
    .optional()
    .isURL()
    .withMessage('Banner must be a valid URL'),
  body('established')
    .optional()
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage('Established field must be between 2 and 20 characters'),
  body('mission')
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Mission must be between 10 and 2000 characters'),
  body('vision')
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Vision must be between 10 and 2000 characters'),
  body('values')
    .optional()
    .isArray()
    .withMessage('Values must be an array'),
  body('achievements')
    .optional()
    .isArray()
    .withMessage('Achievements must be an array'),
  body('color')
    .optional()
    .isObject()
    .withMessage('Color must be an object'),
  body('color.primary')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Primary color is required when color is provided'),
  body('color.secondary')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Secondary color is required when color is provided'),
  body('color.accent')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Accent color is required when color is provided'),
];

export const createOrganizationValidator = [
  body('id').exists().withMessage('Organization slug is required'),
  body('name').exists().withMessage('Organization short name is required'),
  body('fullName').exists().withMessage('Organization full name is required'),
  body('description').exists().withMessage('Description is required'),
  body('longDescription').exists().withMessage('Long description is required'),
  body('logo').exists().withMessage('Logo is required'),
  body('banner').exists().withMessage('Banner is required'),
  body('established').exists().withMessage('Established field is required'),
  body('mission').exists().withMessage('Mission is required'),
  body('vision').exists().withMessage('Vision is required'),
  body('color').exists().withMessage('Color theme is required'),
  ...organizationBaseValidator,
];

export const updateOrganizationValidator = [
  param('id').notEmpty().withMessage('Organization id is required'),
  ...organizationBaseValidator,
];

export const organizationIdValidator = [
  param('id').notEmpty().withMessage('Organization id is required'),
];
