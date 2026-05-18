import { Router } from 'express';
import { uploadImages } from '../controllers/upload.controller';
import { authenticate } from '../middleware/auth';
import { requireAdminAccess } from '../middleware/permissions';
import { upload } from '../middleware/upload';

const router = Router();

router.post('/images', authenticate, requireAdminAccess, upload.array('images', 10), uploadImages);

export default router;
