import { Router } from 'express';
import * as announcementController from '../controllers/announcement.controller';
import { validate } from '../middleware/validate';
import { announcementIdValidator } from '../validators/announcement.validator';

const router: Router = Router();

router.get('/', announcementController.getPublicAnnouncements);
router.get('/:id', validate(announcementIdValidator), announcementController.getPublicAnnouncementById);

export default router;
