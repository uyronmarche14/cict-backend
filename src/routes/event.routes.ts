import { Router } from 'express';
import * as eventController from '../controllers/event.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { requireAdminAccess } from '../middleware/permissions';
import { validate } from '../middleware/validate';
import { logActivity } from '../middleware/activityLogger';
import { handleImageUpload, upload } from '../middleware/upload';
import { 
  createEventValidator, 
  updateEventValidator, 
  eventIdValidator 
} from '../validators/event.validator';
import {
  contentApprovalCommentValidator,
  contentRejectionValidator,
} from '../validators/approval.validator';

const router: Router = Router();

/**
 * @route   POST /api/events
 * @desc    Create new event
 * @access  Private (requires CREATE_EVENT permission)
 */
router.post(
  '/',
  authenticate,
  requireAdminAccess,
  upload.single('image'),
  handleImageUpload,
  validate(createEventValidator),
  logActivity('create', 'event'),
  eventController.createEvent
);

/**
 * @route   GET /api/events
 * @desc    Get all events
 * @access  Public (Published only) or Private (All with filtering)
 */
router.get(
  '/',
  optionalAuthenticate,
  eventController.getAllEvents
);

/**
 * @route   GET /api/events/:id
 * @desc    Get single event
 * @access  Public (Published only) or Private (Any)
 */
router.get(
  '/:id',
  optionalAuthenticate,
  validate(eventIdValidator),
  eventController.getEventById
);

/**
 * @route   PUT /api/events/:id
 * @desc    Update event
 * @access  Private (requires EDIT_EVENT permission)
 */
router.put(
  '/:id',
  authenticate,
  requireAdminAccess,
  upload.single('image'),
  handleImageUpload,
  validate(updateEventValidator),
  logActivity('update', 'event'),
  eventController.updateEvent
);

/**
 * @route   DELETE /api/events/:id
 * @desc    Delete event
 * @access  Private (requires DELETE_EVENT permission)
 */
router.delete(
  '/:id',
  authenticate,
  requireAdminAccess,
  validate(eventIdValidator),
  logActivity('delete', 'event'),
  eventController.deleteEvent
);

router.patch(
  '/:id/submit',
  authenticate,
  requireAdminAccess,
  validate([...eventIdValidator, ...contentApprovalCommentValidator]),
  logActivity('submit_for_approval', 'event'),
  eventController.submitEventForApproval
);

router.patch(
  '/:id/approve',
  authenticate,
  requireAdminAccess,
  validate([...eventIdValidator, ...contentApprovalCommentValidator]),
  logActivity('approve', 'event'),
  eventController.approveEvent
);

router.patch(
  '/:id/reject',
  authenticate,
  requireAdminAccess,
  validate([...eventIdValidator, ...contentRejectionValidator]),
  logActivity('reject', 'event'),
  eventController.rejectEvent
);

router.patch(
  '/:id/publish',
  authenticate,
  requireAdminAccess,
  validate(eventIdValidator),
  logActivity('publish', 'event'),
  eventController.publishEvent
);

router.patch(
  '/:id/cancel',
  authenticate,
  requireAdminAccess,
  validate(eventIdValidator),
  logActivity('cancel', 'event'),
  eventController.cancelEvent
);

router.patch(
  '/:id/complete',
  authenticate,
  requireAdminAccess,
  validate(eventIdValidator),
  logActivity('complete', 'event'),
  eventController.completeEvent
);

/**
 * @route   POST /api/events/:id/join
 * @desc    Join an event
 * @access  Private
 */
router.post(
    '/:id/join',
    authenticate,
    validate(eventIdValidator),
    eventController.joinEvent
);

/**
 * @route   POST /api/events/:id/leave
 * @desc    Leave an event
 * @access  Private
 */
router.post(
    '/:id/leave',
    authenticate,
    validate(eventIdValidator),
    eventController.leaveEvent
);


export default router;
