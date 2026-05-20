import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize, requireAdminAccess } from '../middleware/permissions';
import { Permission } from '../types';
import { validate } from '../middleware/validate';
import * as studentAdminController from '../controllers/studentAdmin.controller';
import {
  createStudentValidator,
  studentIdValidator,
  updateStudentStatusValidator,
  updateStudentValidator,
} from '../validators/student.validator';

const router = Router();

router.use(authenticate, requireAdminAccess);

router.get('/', authorize(Permission.VIEW_STUDENT), studentAdminController.getStudents);
router.post(
  '/',
  authorize(Permission.CREATE_STUDENT),
  validate(createStudentValidator),
  studentAdminController.createStudent
);
router.get(
  '/:id',
  authorize(Permission.VIEW_STUDENT),
  validate(studentIdValidator),
  studentAdminController.getStudentById
);
router.put(
  '/:id',
  authorize(Permission.EDIT_STUDENT),
  validate(updateStudentValidator),
  studentAdminController.updateStudent
);
router.patch(
  '/:id/status',
  authorize(Permission.SET_STUDENT_STATUS),
  validate(updateStudentStatusValidator),
  studentAdminController.updateStudentStatus
);

export default router;
