import { body } from 'express-validator';

export const updateFAQContentValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),

  body('subtitle')
    .trim()
    .notEmpty()
    .withMessage('Subtitle is required')
    .isLength({ max: 300 })
    .withMessage('Subtitle cannot exceed 300 characters'),

  body('topics')
    .isArray({ min: 1 })
    .withMessage('At least one topic is required'),

  body('topics.*.id')
    .trim()
    .notEmpty()
    .withMessage('Topic id is required')
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('Topic ids must be lowercase slug values'),

  body('topics.*.label')
    .trim()
    .notEmpty()
    .withMessage('Topic label is required'),

  body('questions')
    .isArray({ min: 1 })
    .withMessage('At least one FAQ entry is required'),

  body('questions.*.category')
    .trim()
    .notEmpty()
    .withMessage('Question category is required'),

  body('questions.*.question')
    .trim()
    .notEmpty()
    .withMessage('Question is required'),

  body('questions.*.answer')
    .trim()
    .notEmpty()
    .withMessage('Answer is required'),

  body()
    .custom((value) => {
      const topicIds = new Set(
        Array.isArray(value.topics)
          ? value.topics
              .map((topic: { id?: string }) => topic?.id?.trim())
              .filter(Boolean)
          : []
      );

      if (!topicIds.size) {
        throw new Error('At least one topic is required');
      }

      if (
        Array.isArray(value.topics) &&
        value.topics.length !== topicIds.size
      ) {
        throw new Error('Topic ids must be unique');
      }

      const invalidQuestion = Array.isArray(value.questions)
        ? value.questions.find(
            (question: { category?: string }) => !topicIds.has(question?.category?.trim())
          )
        : null;

      if (invalidQuestion) {
        throw new Error('Every FAQ question category must match an existing topic');
      }

      return true;
    }),
];
