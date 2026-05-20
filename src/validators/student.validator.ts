import { body, param } from 'express-validator';
import { StudentStatus } from '../types';

export const createStudentValidator = [
  body('studentNumber').trim().notEmpty().withMessage('Student number is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email must be valid'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('middleName').optional().trim(),
  body('programId').isMongoId().withMessage('programId must be a valid ID'),
  body('yearLevelId').isMongoId().withMessage('yearLevelId must be a valid ID'),
  body('sectionId').isMongoId().withMessage('sectionId must be a valid ID'),
  body('status')
    .optional()
    .isIn(Object.values(StudentStatus))
    .withMessage('Invalid student status'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

export const updateStudentValidator = [
  param('id').isMongoId().withMessage('Invalid student ID'),
  body('studentNumber').optional().trim().notEmpty().withMessage('Student number cannot be empty'),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Email must be valid'),
  body('password')
    .optional({ checkFalsy: true })
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('middleName').optional().trim(),
  body('programId').optional().isMongoId().withMessage('programId must be a valid ID'),
  body('yearLevelId').optional().isMongoId().withMessage('yearLevelId must be a valid ID'),
  body('sectionId').optional().isMongoId().withMessage('sectionId must be a valid ID'),
  body('status')
    .optional()
    .isIn(Object.values(StudentStatus))
    .withMessage('Invalid student status'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
];

export const updateStudentStatusValidator = [
  param('id').isMongoId().withMessage('Invalid student ID'),
  body('status')
    .isIn(Object.values(StudentStatus))
    .withMessage('Invalid student status'),
  body('isActive').isBoolean().withMessage('isActive must be a boolean'),
];

export const studentIdValidator = [param('id').isMongoId().withMessage('Invalid student ID')];
