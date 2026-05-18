import { Request, Response, NextFunction } from 'express';
import Organization from '../models/Organization';
import OrganizationAssignment from '../models/OrganizationAssignment';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { IOrganizationMember, Permission } from '../types';
import {
  canAccessOrganizationScope,
} from '../utils/organizationScope';
import {
  getScopedOrganizationIdsForPermissions,
  hasAnyGlobalPermission,
  ORGANIZATION_MANAGEMENT_PERMISSIONS,
} from '../utils/rbac';

const ORGANIZATION_MUTABLE_FIELDS = [
  'id',
  'name',
  'fullName',
  'description',
  'longDescription',
  'logo',
  'banner',
  'established',
  'mission',
  'vision',
  'values',
  'achievements',
  'color',
] as const;

const buildOrganizationPayload = (body: Record<string, unknown>) => {
  const updates: Partial<Record<(typeof ORGANIZATION_MUTABLE_FIELDS)[number], unknown>> = {};

  for (const field of ORGANIZATION_MUTABLE_FIELDS) {
    if (body[field] !== undefined) {
      updates[field] = field === 'id' && typeof body[field] === 'string'
        ? body[field].trim().toLowerCase()
        : body[field];
    }
  }

  return updates;
};

const attachOrganizationAdminAssignments = async <T extends { id: string }>(
  organizations: T[]
): Promise<Array<T & { adminAssignments: Array<Record<string, unknown>> }>> => {
  if (organizations.length === 0) {
    return [];
  }

  const organizationIds = organizations.map((organization) => organization.id);
  const assignments = await OrganizationAssignment.find({ organizationId: { $in: organizationIds } })
    .populate('user', 'firstName lastName email')
    .populate('role', 'name permissions')
    .lean();

  const assignmentsByOrganization = new Map<string, Array<Record<string, unknown>>>();

  for (const assignment of assignments) {
    const user =
      assignment.user && typeof assignment.user === 'object'
        ? assignment.user
        : null;
    const role =
      assignment.role && typeof assignment.role === 'object'
        ? assignment.role
        : null;

    const serializedAssignment = {
      id: String(assignment._id),
      organizationId: assignment.organizationId,
      roleId: role?._id ? String(role._id) : null,
      roleName: role?.name ?? 'Scoped Role',
      permissions: role?.permissions ?? [],
      userId: user?._id ? String(user._id) : null,
      userName: user ? `${user.firstName} ${user.lastName}`.trim() : null,
      userEmail: user?.email ?? null,
    };

    const current = assignmentsByOrganization.get(assignment.organizationId) ?? [];
    current.push(serializedAssignment);
    assignmentsByOrganization.set(assignment.organizationId, current);
  }

  return organizations.map((organization) => ({
    ...organization,
    adminAssignments: assignmentsByOrganization.get(organization.id) ?? [],
  }));
};

const ensureCanManageOrganization = (
  req: AuthRequest,
  organizationId: string,
  permission: Permission
) => {
  if (!req.user) {
    throw new AppError('User not authenticated', 401);
  }

  if (!canAccessOrganizationScope(req.user, organizationId, permission)) {
    throw new AppError('You do not have access to manage this organization scope', 403);
  }
};

const getAdminVisibleOrganizationIds = (req: AuthRequest): string[] => {
  if (!req.user) {
    return [];
  }

  return getScopedOrganizationIdsForPermissions(
    req.user.organizationAssignments,
    ORGANIZATION_MANAGEMENT_PERMISSIONS
  );
};

// @desc    Get all organizations
// @route   GET /api/organizations
// @access  Public
export const getOrganizations = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const organizations = await Organization.find().lean();
    
    res.status(200).json({
      success: true,
      data: organizations,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get organization by ID (slug)
// @route   GET /api/organizations/:id
// @access  Public
export const getOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organization = await Organization.findOne({ id: req.params.id }).lean();

    if (!organization) {
      return next(new AppError('Organization not found', 404));
    }

    res.status(200).json({
      success: true,
      data: organization,
    });
  } catch (err) {
    next(err);
  }
};

export const getAdminOrganizations = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    const scopedOrganizationIds = getAdminVisibleOrganizationIds(req);
    const hasOrganizationManagementAccess =
      hasAnyGlobalPermission(req.user, ORGANIZATION_MANAGEMENT_PERMISSIONS) ||
      scopedOrganizationIds.length > 0;

    if (!hasOrganizationManagementAccess) {
      return next(new AppError('You do not have access to organization administration', 403));
    }

    const query = hasAnyGlobalPermission(req.user, ORGANIZATION_MANAGEMENT_PERMISSIONS)
      ? {}
      : scopedOrganizationIds.length > 0
        ? { id: { $in: scopedOrganizationIds } }
        : { _id: null };

    const organizations = await Organization.find(query).lean();
    const organizationsWithAssignments = await attachOrganizationAdminAssignments(organizations);

    res.status(200).json({
      success: true,
      data: organizationsWithAssignments,
    });
  } catch (err) {
    next(err);
  }
};

export const getAdminOrganization = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    const organization = await Organization.findOne({ id: req.params.id }).lean();

    if (!organization) {
      return next(new AppError('Organization not found', 404));
    }

    const canViewOrganization =
      hasAnyGlobalPermission(req.user, ORGANIZATION_MANAGEMENT_PERMISSIONS) ||
      getAdminVisibleOrganizationIds(req).includes(organization.id);

    if (!canViewOrganization) {
      return next(new AppError('You do not have access to this organization scope', 403));
    }

    const [organizationWithAssignments] = await attachOrganizationAdminAssignments([organization]);

    res.status(200).json({
      success: true,
      data: organizationWithAssignments,
    });
  } catch (err) {
    next(err);
  }
};

export const getAdminOrganizationAssignments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(new AppError('User not authenticated', 401));
    }

    const organization = await Organization.findOne({ id: req.params.id })
      .select('id')
      .lean();

    if (!organization) {
      return next(new AppError('Organization not found', 404));
    }

    const canViewAssignments =
      hasAnyGlobalPermission(req.user, ORGANIZATION_MANAGEMENT_PERMISSIONS) ||
      getAdminVisibleOrganizationIds(req).includes(organization.id);

    if (!canViewAssignments) {
      return next(new AppError('You do not have access to this organization scope', 403));
    }

    const [organizationWithAssignments] = await attachOrganizationAdminAssignments([
      { id: organization.id },
    ]);

    res.status(200).json({
      success: true,
      data: {
        assignments: organizationWithAssignments?.adminAssignments ?? [],
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create organization
// @route   POST /api/organizations
// @access  Private
export const createOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = buildOrganizationPayload(req.body);
    const organizationId = payload.id as string | undefined;

    if (!organizationId) {
      return next(new AppError('Organization slug is required', 400));
    }

    const existingOrganization = await Organization.findOne({ id: organizationId });
    if (existingOrganization) {
      return next(new AppError('Organization slug already exists', 409));
    }

    const organization = await Organization.create({
      ...(payload as Record<string, unknown>),
      members: [],
    });

    res.status(201).json({
      success: true,
      data: organization,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update organization details
// @route   PUT /api/organizations/:id
// @access  Private (Admin/Semi Admin)
export const updateOrganization = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Find first to make sure it exists
    const organization = await Organization.findOne({ id });

    if (!organization) {
      return next(new AppError('Organization not found', 404));
    }

    ensureCanManageOrganization(req, organization.id, Permission.EDIT_ORGANIZATION);

    const updates = buildOrganizationPayload(req.body);
    const requestedSlug = updates.id as string | undefined;

    if (requestedSlug && requestedSlug !== organization.id) {
      const slugConflict = await Organization.findOne({ id: requestedSlug });
      if (slugConflict) {
        return next(new AppError('Organization slug already exists', 409));
      }
    }

    // Update fields
    const updatedOrg = await Organization.findOneAndUpdate(
      { id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedOrg,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete organization
// @route   DELETE /api/organizations/:id
// @access  Private
export const deleteOrganization = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    ensureCanManageOrganization(req, req.params.id, Permission.DELETE_ORGANIZATION);
    const organization = await Organization.findOneAndDelete({ id: req.params.id });

    if (!organization) {
      return next(new AppError('Organization not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Organization deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add a member to an organization
// @route   POST /api/organizations/:id/members
// @access  Private (Admin/Semi Admin)
export const addMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const memberData: IOrganizationMember = req.body;

    const organization = await Organization.findOne({ id });

    if (!organization) {
      return next(new AppError('Organization not found', 404));
    }

    ensureCanManageOrganization(req, organization.id, Permission.CREATE_MEMBER);

    // Generate a simple ID if not provided (timestamp based)
    if (!memberData.id) {
      memberData.id = Date.now().toString();
    }

    // Check if member ID collision (unlikely with timestamp but good practice)
    if (organization.members.some(m => m.id === memberData.id)) {
      memberData.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    }

    organization.members.push(memberData);
    await organization.save();

    res.status(201).json({
      success: true,
      data: organization,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update a member in an organization
// @route   PUT /api/organizations/:orgId/members/:memberId
// @access  Private (Admin/Semi Admin)
export const updateMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orgId, memberId } = req.params;
    const memberUpdate = req.body;

    const organization = await Organization.findOne({ id: orgId });

    if (!organization) {
      return next(new AppError('Organization not found', 404));
    }

    ensureCanManageOrganization(req, organization.id, Permission.EDIT_MEMBER);

    const memberIndex = organization.members.findIndex(m => m.id === memberId);

    if (memberIndex === -1) {
      return next(new AppError('Member not found', 404));
    }

    // Update member fields
    // We merge existing member data with updates
    organization.members[memberIndex] = { ...organization.members[memberIndex], ...memberUpdate };
    
    // Mongoose sometimes doesn't detect deep changes in arrays of objects unless marked
    organization.markModified('members');
    
    await organization.save();

    res.status(200).json({
      success: true,
      data: organization,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a member from an organization
// @route   DELETE /api/organizations/:orgId/members/:memberId
// @access  Private (Admin/Semi Admin)
export const deleteMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orgId, memberId } = req.params;

    const organization = await Organization.findOne({ id: orgId });

    if (!organization) {
      return next(new AppError('Organization not found', 404));
    }

    ensureCanManageOrganization(req, organization.id, Permission.DELETE_MEMBER);

    const memberIndex = organization.members.findIndex(m => m.id === memberId);

    if (memberIndex === -1) {
      return next(new AppError('Member not found', 404));
    }

    organization.members.splice(memberIndex, 1);
    await organization.save();

    res.status(200).json({
      success: true,
      message: 'Member removed',
      data: organization
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Upload an image (returns URL)
// @route   POST /api/organizations/upload
// @access  Private (Admin/Semi Admin)
export const uploadImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.body.imageUrl) {
      return next(new AppError('No image uploaded', 400));
    }

    res.status(200).json({
      success: true,
      data: {
        imageUrl: req.body.imageUrl,
        imageId: req.body.imageId
      }
    });
  } catch (err) {
    next(err);
  }
};
