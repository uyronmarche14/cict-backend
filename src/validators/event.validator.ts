import { body, param } from 'express-validator';
import { EventStatus } from '../types';

export const createEventValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters'),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required'),
  
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
  
  body('status')
    .optional()
    .isIn(Object.values(EventStatus))
    .withMessage('Invalid status'),

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
  
  body('status')
    .optional()
    .isIn(Object.values(EventStatus))
    .withMessage('Invalid status'),

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
