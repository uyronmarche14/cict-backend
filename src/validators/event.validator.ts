import { body, param } from 'express-validator';
import { ContentOwnerType } from '../types';

export const createEventValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters'),
  
  body('bodyHtml')
    .optional()
    .trim(),

  body('description')
    .optional()
    .trim(),

  body()
    .custom((value) => {
      const bodyHtml = typeof value.bodyHtml === 'string' ? value.bodyHtml.trim() : '';
      const description = typeof value.description === 'string' ? value.description.trim() : '';

      if (!bodyHtml && !description) {
        throw new Error('Description is required');
      }

      return true;
    }),
  
  body('excerpt')
    .trim()
    .notEmpty()
    .withMessage('Excerpt is required')
    .isLength({ max: 200 })
    .withMessage('Excerpt cannot exceed 200 characters'),

  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid date'),

  body('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('End date must be a valid date'),

  body('location')
    .trim()
    .notEmpty()
    .withMessage('Location is required'),
  
  body('tags')
    .optional()
    .toArray()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('imageUrl')
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage('Image URL must be a valid URL'),

  body('coverImage')
    .optional()
    .isObject()
    .withMessage('Cover image must be an object'),

  body('gallery')
    .optional()
    .isArray()
    .withMessage('Gallery must be an array'),

  body('sections')
    .optional()
    .isArray()
    .withMessage('Sections must be an array'),

  body('schedule')
    .optional()
    .isArray()
    .withMessage('Schedule must be an array'),

  body('ownerType')
    .optional()
    .isIn(Object.values(ContentOwnerType))
    .withMessage('ownerType must be system or organization'),

  body('organizationId')
    .optional({ nullable: true })
    .isString()
    .withMessage('organizationId must be a string'),

  body()
    .custom((value) => {
      const ownerType =
        value.ownerType === ContentOwnerType.ORGANIZATION
          ? ContentOwnerType.ORGANIZATION
          : ContentOwnerType.SYSTEM;
      const organizationId =
        typeof value.organizationId === 'string' ? value.organizationId.trim() : '';

      if (ownerType === ContentOwnerType.SYSTEM && organizationId) {
        throw new Error('System-owned content cannot include organizationId');
      }

      if (ownerType === ContentOwnerType.ORGANIZATION && !organizationId) {
        throw new Error('organizationId is required for organization-owned content');
      }

      return true;
    }),
  
  body('status')
    .not()
    .exists()
    .withMessage('Use the event workflow endpoints to change status'),

  body('approvalSummary')
    .not()
    .exists()
    .withMessage('approvalSummary is managed by workflow endpoints'),

  body('processInstanceId')
    .not()
    .exists()
    .withMessage('processInstanceId is managed by workflow endpoints'),

  body('maxAttendees')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Max attendees must be a positive integer'),
];

export const updateEventValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid event ID'),
  
  body('title')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters'),
  
  body('bodyHtml')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Body content cannot be empty'),

  body('description')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Description cannot be empty'),

    body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),

  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  
  body('tags')
    .optional()
    .toArray()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('imageUrl')
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage('Image URL must be a valid URL'),

  body('coverImage')
    .optional()
    .isObject()
    .withMessage('Cover image must be an object'),

  body('gallery')
    .optional()
    .isArray()
    .withMessage('Gallery must be an array'),

  body('sections')
    .optional()
    .isArray()
    .withMessage('Sections must be an array'),

  body('schedule')
    .optional()
    .isArray()
    .withMessage('Schedule must be an array'),

  body('ownerType')
    .optional()
    .isIn(Object.values(ContentOwnerType))
    .withMessage('ownerType must be system or organization'),

  body('organizationId')
    .optional({ nullable: true })
    .custom((value) => value === null || typeof value === 'string')
    .withMessage('organizationId must be a string or null'),
  
  body('status')
    .not()
    .exists()
    .withMessage('Use the event workflow endpoints to change status'),

  body('publishedAt')
    .not()
    .exists()
    .withMessage('publishedAt is managed by workflow endpoints'),

  body('cancelledAt')
    .not()
    .exists()
    .withMessage('cancelledAt is managed by workflow endpoints'),

  body('completedAt')
    .not()
    .exists()
    .withMessage('completedAt is managed by workflow endpoints'),

  body('approvalSummary')
    .not()
    .exists()
    .withMessage('approvalSummary is managed by workflow endpoints'),

  body('processInstanceId')
    .not()
    .exists()
    .withMessage('processInstanceId is managed by workflow endpoints'),

    body('maxAttendees')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Max attendees must be a positive integer'),
];

export const eventIdValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid event ID'),
];

export const eventRegIdValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid event ID'),
  param('regId')
    .isMongoId()
    .withMessage('Invalid registration ID'),
];
