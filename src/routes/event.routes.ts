import { Router } from 'express';
import * as eventController from '../controllers/event.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { authorize } from '../middleware/permissions';
import { validate } from '../middleware/validate';
import { logActivity } from '../middleware/activityLogger';
import { handleImageUpload, upload } from '../middleware/upload';
import { 
  createEventValidator, 
  updateEventValidator, 
  eventIdValidator 
} from '../validators/event.validator';
import { Permission } from '../types';

const router: Router = Router();

/**
 * @route   POST /api/events
 * @desc    Create new event
 * @access  Private (requires CREATE_EVENT permission)
 */
router.post(
  '/',
  authenticate,
  authorize(Permission.CREATE_EVENT),
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
  authorize(Permission.EDIT_EVENT),
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
  authorize(Permission.DELETE_EVENT),
  validate(eventIdValidator),
  logActivity('delete', 'event'),
  eventController.deleteEvent
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
    logActivity('join', 'event'),
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
    logActivity('leave', 'event'),
    eventController.leaveEvent
);


export default router;
