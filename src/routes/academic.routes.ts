import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize, requireAdminAccess } from '../middleware/permissions';
import { Permission } from '../types';
import { validate } from '../middleware/validate';
import * as academicController from '../controllers/academic.controller';
import {
  createProgramValidator,
  createSectionValidator,
  createYearLevelValidator,
  updateProgramValidator,
  updateSectionValidator,
  updateYearLevelValidator,
} from '../validators/academic.validator';

const router = Router();

router.use(authenticate, requireAdminAccess);

router.get('/programs', authorize(Permission.VIEW_ACADEMIC_GROUPS), academicController.getPrograms);
router.post(
  '/programs',
  authorize(Permission.MANAGE_ACADEMIC_GROUPS),
  validate(createProgramValidator),
  academicController.createProgram
);
router.put(
  '/programs/:id',
  authorize(Permission.MANAGE_ACADEMIC_GROUPS),
  validate(updateProgramValidator),
  academicController.updateProgram
);

router.get(
  '/year-levels',
  authorize(Permission.VIEW_ACADEMIC_GROUPS),
  academicController.getYearLevels
);
router.post(
  '/year-levels',
  authorize(Permission.MANAGE_ACADEMIC_GROUPS),
  validate(createYearLevelValidator),
  academicController.createYearLevel
);
router.put(
  '/year-levels/:id',
  authorize(Permission.MANAGE_ACADEMIC_GROUPS),
  validate(updateYearLevelValidator),
  academicController.updateYearLevel
);

router.get('/sections', authorize(Permission.VIEW_ACADEMIC_GROUPS), academicController.getSections);
router.post(
  '/sections',
  authorize(Permission.MANAGE_ACADEMIC_GROUPS),
  validate(createSectionValidator),
  academicController.createSection
);
router.put(
  '/sections/:id',
  authorize(Permission.MANAGE_ACADEMIC_GROUPS),
  validate(updateSectionValidator),
  academicController.updateSection
);

export default router;
