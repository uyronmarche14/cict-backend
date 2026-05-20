import { Router } from 'express';
import * as newsController from '../controllers/news.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { requireAdminAccess } from '../middleware/permissions';
import { validate } from '../middleware/validate';
import { logActivity } from '../middleware/activityLogger';
import { handleImageUpload, upload } from '../middleware/upload';
import {
  createNewsValidator, 
  updateNewsValidator, 
  newsIdValidator 
} from '../validators/news.validator';
import {
  contentApprovalCommentValidator,
  contentRejectionValidator,
} from '../validators/approval.validator';

const router: Router = Router();

/**
 * @route   POST /api/news
 * @desc    Create new news article
 * @access  Private (requires CREATE_NEWS permission)
 */
router.post(
 '/',
  authenticate,
  requireAdminAccess,
  upload.single('image'),
  handleImageUpload,
  validate(createNewsValidator),
  logActivity('create', 'news'),
  newsController.createNews
);

/**
 * @route   GET /api/news
 * @desc    Get all news articles
 * @access  Public (Published only) or Private (All with filtering)
 */
router.get(
  '/',
  optionalAuthenticate,
  newsController.getAllNews
);

/**
 * @route   GET /api/news/:id
 * @desc    Get single news article
 * @access  Public (Published only) or Private (Any)
 */
router.get(
  '/:id',
  optionalAuthenticate,
  validate(newsIdValidator),
  newsController.getNewsById
);

/**
 * @route   PUT /api/news/:id
 * @desc    Update news article
 * @access  Private (requires EDIT_NEWS permission)
 */
router.put(
 '/:id',
  authenticate,
  requireAdminAccess,
  upload.single('image'),
  handleImageUpload,
  validate(updateNewsValidator),
  logActivity('update', 'news'),
  newsController.updateNews
);

/**
 * @route   DELETE /api/news/:id
 * @desc    Delete news article
 * @access  Private (requires DELETE_NEWS permission)
 */
router.delete(
 '/:id',
  authenticate,
  requireAdminAccess,
  validate(newsIdValidator),
  logActivity('delete', 'news'),
  newsController.deleteNews
);

/**
 * @route   PATCH /api/news/:id/publish
 * @desc    Publish news article
 * @access  Private (requires PUBLISH_NEWS permission)
 */
router.patch(
 '/:id/submit',
  authenticate,
  requireAdminAccess,
  validate([...newsIdValidator, ...contentApprovalCommentValidator]),
  logActivity('submit_for_approval', 'news'),
  newsController.submitNewsForApproval
);

router.patch(
 '/:id/approve',
  authenticate,
  requireAdminAccess,
  validate([...newsIdValidator, ...contentApprovalCommentValidator]),
  logActivity('approve', 'news'),
  newsController.approveNews
);

router.patch(
 '/:id/reject',
  authenticate,
  requireAdminAccess,
  validate([...newsIdValidator, ...contentRejectionValidator]),
  logActivity('reject', 'news'),
  newsController.rejectNews
);

router.patch(
 '/:id/publish',
  authenticate,
  requireAdminAccess,
  validate(newsIdValidator),
  logActivity('publish', 'news'),
  newsController.publishNews
);

/**
 * @route   PATCH /api/news/:id/archive
 * @desc    Archive news article
 * @access  Private (requires ARCHIVE_NEWS permission)
 */
router.patch(
 '/:id/archive',
  authenticate,
  requireAdminAccess,
  validate(newsIdValidator),
  logActivity('archive', 'news'),
  newsController.archiveNews
);

export default router;
