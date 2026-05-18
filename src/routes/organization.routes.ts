import express from 'express';
import {
  getOrganizations,
  getOrganization,
  getAdminOrganizations,
  getAdminOrganization,
  getAdminOrganizationAssignments,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  addMember,
  updateMember,
  deleteMember,
  uploadImage,
} from '../controllers/organization.controller';
import { authenticate as protect } from '../middleware/auth';
import { authorize, requireAdminAccess } from '../middleware/permissions';
import { Permission } from '../types';
import { upload, handleImageUpload } from '../middleware/upload';
import { validate } from '../middleware/validate';
import {
  createOrganizationValidator,
  organizationIdValidator,
  updateOrganizationValidator,
} from '../validators/organization.validator';

const router = express.Router();

// Public routes
router.get('/admin', protect, requireAdminAccess, getAdminOrganizations);
router.get('/admin/:id/assignments', protect, requireAdminAccess, getAdminOrganizationAssignments);
router.get('/admin/:id', protect, requireAdminAccess, getAdminOrganization);
router.get('/', getOrganizations);
router.get('/:id', getOrganization);

// Protected routes (Admin/Semi Admin)
router.use(protect);

// Upload generic image
router.post(
  '/upload',
  requireAdminAccess,
  upload.single('image'),
  handleImageUpload,
  uploadImage
);

// Organization Management
router.post(
  '/',
  authorize(Permission.CREATE_ORGANIZATION),
  validate(createOrganizationValidator),
  createOrganization
);

router.put(
  '/:id',
  requireAdminAccess,
  validate(updateOrganizationValidator),
  updateOrganization
);

router.delete(
  '/:id',
  requireAdminAccess,
  validate(organizationIdValidator),
  deleteOrganization
);

// Members Management
router.post(
  '/:id/members',
  requireAdminAccess,
  addMember
);

router.put(
  '/:orgId/members/:memberId',
  requireAdminAccess,
  updateMember
);

router.delete(
  '/:orgId/members/:memberId',
  requireAdminAccess,
  deleteMember
);

export default router;
