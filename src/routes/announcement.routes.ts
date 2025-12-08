import { Router } from 'express';
import * as announcementController from '../controllers/announcement.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/permissions';
import { logActivity } from '../middleware/activityLogger';
import { handleImageUpload, upload } from '../middleware/upload';
import { Permission } from '../types';

const router: Router = Router();

/**
 * @route   POST /api/announcements
 * @desc    Create new announcement
 * @access  Private (requires CREATE_ANNOUNCEMENT permission)
 */
router.post(
  '/',
  authenticate,
  authorize(Permission.CREATE_ANNOUNCEMENT),
  upload.single('image'),
  handleImageUpload,
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
  authorize(Permission.VIEW_ANNOUNCEMENT),
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
  authorize(Permission.VIEW_ANNOUNCEMENT),
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
  authorize(Permission.EDIT_ANNOUNCEMENT),
  upload.single('image'),
  handleImageUpload,
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
  authorize(Permission.DELETE_ANNOUNCEMENT),
  logActivity('delete', 'announcement'),
  announcementController.deleteAnnouncement
);

/**
 * @route   PATCH /api/announcements/:id/publish
 * @desc    Publish announcement
 * @access  Private (requires PUBLISH_ANNOUNCEMENT permission)
 */
router.patch(
  '/:id/publish',
  authenticate,
  authorize(Permission.PUBLISH_ANNOUNCEMENT),
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
  authorize(Permission.ARCHIVE_ANNOUNCEMENT),
  logActivity('archive', 'announcement'),
  announcementController.archiveAnnouncement
);

export default router;
