import { Router } from 'express';
import * as faqController from '../controllers/faq.controller';
import { authenticate } from '../middleware/auth';
import { authorizeAny } from '../middleware/permissions';
import { validate } from '../middleware/validate';
import { logActivity } from '../middleware/activityLogger';
import { Permission } from '../types';
import { updateFAQContentValidator } from '../validators/faq.validator';

const router: Router = Router();

router.get('/', faqController.getFAQContent);

router.put(
  '/',
  authenticate,
  authorizeAny(Permission.MANAGE_SETTINGS),
  validate(updateFAQContentValidator),
  logActivity('update', 'faq'),
  faqController.upsertFAQContent
);

export default router;
