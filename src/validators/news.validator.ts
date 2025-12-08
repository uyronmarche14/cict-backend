import { body, param } from 'express-validator';
import { NewsStatus } from '../types';

export const createNewsValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Content is required'),
  
  body('excerpt')
    .trim()
    .notEmpty()
    .withMessage('Excerpt is required')
    .isLength({ max: 500 })
    .withMessage('Excerpt cannot exceed 500 characters'),
  
  body('tags')
    .optional()
    .toArray()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('imageUrl')
    .optional({ checkFalsy: true }) // Allows empty string or null
    .isURL()
    .withMessage('Image URL must be a valid URL'),
  
  body('status')
    .optional()
    .isIn(Object.values(NewsStatus))
    .withMessage('Invalid status'),
];

export const updateNewsValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid news ID'),
  
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  
  body('content')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Content cannot be empty'),
  
  body('excerpt')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Excerpt cannot exceed 500 characters'),
  
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
    .isIn(Object.values(NewsStatus))
    .withMessage('Invalid status'),
];

export const newsIdValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid news ID'),
];
