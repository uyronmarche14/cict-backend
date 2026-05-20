import { Router } from 'express';
import { getAuditLogs, getAuditLogById, getAuditSummary } from '../controllers/audit.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/permissions';
import { Permission } from '../types';

const router = Router();

router.use(authenticate);

router.get('/logs', authorize(Permission.VIEW_LOGS), getAuditLogs);
router.get('/logs/:id', authorize(Permission.VIEW_LOGS), getAuditLogById);
router.get('/summary', authorize(Permission.VIEW_LOGS), getAuditSummary);

export default router;
