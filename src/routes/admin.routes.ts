import { Router } from 'express';
import { getDashboardSummary } from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth';
import { requireAdminAccess } from '../middleware/permissions';

const router = Router();

router.get('/dashboard/summary', authenticate, requireAdminAccess, getDashboardSummary);

export default router;
