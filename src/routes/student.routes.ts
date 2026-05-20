import { Router } from 'express';
import { authenticateStudent } from '../middleware/studentAuth';
import * as studentController from '../controllers/student.controller';
import * as eventRegistrationController from '../controllers/eventRegistration.controller';
import { validate } from '../middleware/validate';
import { eventIdValidator } from '../validators/event.validator';

const router = Router();

router.use(authenticateStudent);

router.get('/profile', studentController.getOwnStudentProfile);
router.get('/events', eventRegistrationController.getStudentEvents);
router.post('/events/:id/register', validate(eventIdValidator), eventRegistrationController.registerForEvent);
router.post(
  '/events/:id/cancel-registration',
  validate(eventIdValidator),
  eventRegistrationController.cancelEventRegistration
);
router.get(
  '/events/:id/registration',
  validate(eventIdValidator),
  eventRegistrationController.getOwnEventRegistration
);
router.get('/registrations', eventRegistrationController.getStudentRegistrations);
router.get('/events/:id/qr', validate(eventIdValidator), eventRegistrationController.getEventQrPayload);
router.get('/attendance/history', eventRegistrationController.getStudentAttendanceHistory);

export default router;
