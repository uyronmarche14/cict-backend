import { Router } from 'express';
import * as announcementController from '../controllers/announcement.controller';
import { authenticate } from '../middleware/auth';
import { requireAdminAccess } from '../middleware/permissions';
import { logActivity } from '../middleware/activityLogger';
import { handleImageUpload, upload } from '../middleware/upload';
import { validate } from '../middleware/validate';
import {
  announcementIdValidator,
  createAnnouncementValidator,
  updateAnnouncementValidator,
} from '../validators/announcement.validator';
import {
  contentApprovalCommentValidator,
  contentRejectionValidator,
} from '../validators/approval.validator';

const router: Router = Router();

/**
 * @route   POST /api/announcements
 * @desc    Create new announcement
 * @access  Private (requires CREATE_ANNOUNCEMENT permission)
 */
router.post(
  '/',
  authenticate,
  requireAdminAccess,
  upload.single('image'),
  handleImageUpload,
  validate(createAnnouncementValidator),
  logActivity('create', 'announcement'),
  announcementController.createAnnouncement
);

/**
 * @route   GET /api/announcements
 * @desc    Get all announcements
 * @access  Private (requires VIEW_ANNOUNCEMENT permission)
 */
router.get(
  '/',
  authenticate,
  requireAdminAccess,
  announcementController.getAllAnnouncements
);

/**
 * @route   GET /api/announcements/:id
 * @desc    Get single announcement
 * @access  Private (requires VIEW_ANNOUNCEMENT permission)
 */
router.get(
  '/:id',
  authenticate,
  requireAdminAccess,
  validate(announcementIdValidator),
  announcementController.getAnnouncementById
);

/**
 * @route   PUT /api/announcements/:id
 * @desc    Update announcement
 * @access  Private (requires EDIT_ANNOUNCEMENT permission)
 */
router.put(
  '/:id',
  authenticate,
  requireAdminAccess,
  upload.single('image'),
  handleImageUpload,
  validate(updateAnnouncementValidator),
  logActivity('update', 'announcement'),
  announcementController.updateAnnouncement
);

/**
 * @route   DELETE /api/announcements/:id
 * @desc    Delete announcement
 * @access  Private (requires DELETE_ANNOUNCEMENT permission)
 */
router.delete(
  '/:id',
  authenticate,
  requireAdminAccess,
  validate(announcementIdValidator),
  logActivity('delete', 'announcement'),
  announcementController.deleteAnnouncement
);

/**
 * @route   PATCH /api/announcements/:id/publish
 * @desc    Publish announcement
 * @access  Private (requires PUBLISH_ANNOUNCEMENT permission)
 */
router.patch(
  '/:id/submit',
  authenticate,
  requireAdminAccess,
  validate([...announcementIdValidator, ...contentApprovalCommentValidator]),
  logActivity('submit_for_approval', 'announcement'),
  announcementController.submitAnnouncementForApproval
);

router.patch(
  '/:id/approve',
  authenticate,
  requireAdminAccess,
  validate([...announcementIdValidator, ...contentApprovalCommentValidator]),
  logActivity('approve', 'announcement'),
  announcementController.approveAnnouncement
);

router.patch(
  '/:id/reject',
  authenticate,
  requireAdminAccess,
  validate([...announcementIdValidator, ...contentRejectionValidator]),
  logActivity('reject', 'announcement'),
  announcementController.rejectAnnouncement
);

router.patch(
  '/:id/publish',
  authenticate,
  requireAdminAccess,
  validate(announcementIdValidator),
  logActivity('publish', 'announcement'),
  announcementController.publishAnnouncement
);

/**
 * @route   PATCH /api/announcements/:id/archive
 * @desc    Archive announcement
 * @access  Private (requires ARCHIVE_ANNOUNCEMENT permission)
 */
router.patch(
  '/:id/archive',
  authenticate,
  requireAdminAccess,
  validate(announcementIdValidator),
  logActivity('archive', 'announcement'),
  announcementController.archiveAnnouncement
);

export default router;
