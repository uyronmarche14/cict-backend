import { body } from 'express-validator';

export const contentApprovalCommentValidator = [
  body('comment')
    .optional()
    .isString()
    .withMessage('comment must be a string')
    .trim()
    .isLength({ max: 500 })
    .withMessage('comment cannot exceed 500 characters'),
];

export const contentRejectionValidator = [
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('reason is required')
    .isLength({ max: 500 })
    .withMessage('reason cannot exceed 500 characters'),
  ...contentApprovalCommentValidator,
];
