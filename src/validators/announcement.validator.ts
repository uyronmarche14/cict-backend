import { body, param } from 'express-validator';
import { AnnouncementPriority, AnnouncementType, ContentOwnerType } from '../types';

export const createAnnouncementValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),

  body('bodyHtml')
    .optional()
    .trim(),

  body('content')
    .optional()
    .trim(),

  body()
    .custom((value) => {
      const bodyHtml = typeof value.bodyHtml === 'string' ? value.bodyHtml.trim() : '';
      const content = typeof value.content === 'string' ? value.content.trim() : '';

      if (!bodyHtml && !content) {
        throw new Error('Body content is required');
      }

      return true;
    }),

  body('priority')
    .optional()
    .isIn(Object.values(AnnouncementPriority))
    .withMessage('Invalid priority'),

  body('type')
    .optional()
    .isIn(Object.values(AnnouncementType))
    .withMessage('Invalid type'),

  body('targetAudience')
    .optional()
    .toArray()
    .isArray()
    .withMessage('targetAudience must be an array'),

  body('expiresAt')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('expiresAt must be a valid ISO date'),

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
    .withMessage('Use the publish/archive workflow endpoints to change status'),

  body('approvalSummary')
    .not()
    .exists()
    .withMessage('approvalSummary is managed by workflow endpoints'),

  body('processInstanceId')
    .not()
    .exists()
    .withMessage('processInstanceId is managed by workflow endpoints'),
];

export const updateAnnouncementValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid announcement ID'),

  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),

  body('bodyHtml')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Body content cannot be empty'),

  body('content')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Content cannot be empty'),

  body('priority')
    .optional()
    .isIn(Object.values(AnnouncementPriority))
    .withMessage('Invalid priority'),

  body('type')
    .optional()
    .isIn(Object.values(AnnouncementType))
    .withMessage('Invalid type'),

  body('targetAudience')
    .optional()
    .toArray()
    .isArray()
    .withMessage('targetAudience must be an array'),

  body('expiresAt')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('expiresAt must be a valid ISO date'),

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
    .withMessage('Use the publish/archive workflow endpoints to change status'),

  body('publishedAt')
    .not()
    .exists()
    .withMessage('publishedAt is managed by workflow endpoints'),

  body('archivedAt')
    .not()
    .exists()
    .withMessage('archivedAt is managed by workflow endpoints'),

  body('isActive')
    .not()
    .exists()
    .withMessage('isActive is managed by workflow endpoints'),

  body('approvalSummary')
    .not()
    .exists()
    .withMessage('approvalSummary is managed by workflow endpoints'),

  body('processInstanceId')
    .not()
    .exists()
    .withMessage('processInstanceId is managed by workflow endpoints'),
];

export const announcementIdValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid announcement ID'),
];
