import { body } from 'express-validator';

export const studentLoginValidator = [
  body('identifier').trim().notEmpty().withMessage('Identifier is required'),
  body('password').trim().notEmpty().withMessage('Password is required'),
  body('deviceLabel').optional().trim(),
  body('platform').optional().trim(),
];

export const studentRefreshValidator = [
  body('refreshToken').trim().notEmpty().withMessage('refreshToken is required'),
];
