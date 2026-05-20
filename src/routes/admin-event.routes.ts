import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdminAccess } from '../middleware/permissions';
import { validate } from '../middleware/validate';
import { eventIdValidator } from '../validators/event.validator';
import {
  getEventRegistrationsForAdmin,
  scanEventAttendance,
} from '../controllers/eventRegistration.controller';

const router = Router();

router.use(authenticate, requireAdminAccess);

router.get('/:id/registrations', validate(eventIdValidator), getEventRegistrationsForAdmin);
router.post('/:id/attendance/scan', validate(eventIdValidator), scanEventAttendance);

export default router;
