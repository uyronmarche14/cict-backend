import { Request, Response } from 'express';
import { Types } from 'mongoose';
import User from '../models/User';
import Role from '../models/Role';
import Organization from '../models/Organization';
import OrganizationAssignment from '../models/OrganizationAssignment';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import {
  AdminModule,
  IAdminScopes,
  IResolvedOrganizationAssignment,
  IScopedAdminModulesByOrganization,
  Permission,
  UserRole,
} from '../types';
import logger from '../utils/logger';
import {
  canAccessAdminPanel,
  deriveAdminScopes,
  deriveScopedAdminModulesByOrganization,
  deriveVisibleAdminModules,
  findActiveFullAdminCount,
  getDefaultPermissions,
  getSystemRoleDefinition,
  hasGlobalPermission,
} from '../utils/rbac';
import { getResolvedOrganizationAssignmentsForUser } from '../utils/organizationScope';

const PROTECTED_USER_FIELDS = ['role', 'customRole', 'customRoleId', 'isActive'];

type SerializedUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  baseRoleLabel: string;
  customRoleId: string | null;
  customRole?: {
    id: string;
    name: string;
    description: string;
    permissions?: Permission[];
  } | null;
  effectiveRoleLabel: string;
  effectiveRoleKind: 'system' | 'custom';
  effectivePermissions: Permission[];
  canAccessAdmin: boolean;
  adminScopes: IAdminScopes;
  visibleAdminModules: AdminModule[];
  scopedAdminModulesByOrganization: IScopedAdminModulesByOrganization;
  organizationAssignments: IResolvedOrganizationAssignment[];
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const getSystemRoleLabel = (role: UserRole): string => getSystemRoleDefinition(role).name;

const ensurePermissionSetWithinActorScope = (
  actorPermissions: Permission[],
  requestedPermissions: Permission[],
  errorMessage: string
) => {
  const unauthorizedPermissions = requestedPermissions.filter(
    (permission) => !actorPermissions.includes(permission)
  );

  if (unauthorizedPermissions.length > 0) {
    throw new AppError(`${errorMessage}: ${unauthorizedPermissions.join(', ')}`, 403);
  }
};

const serializeUser = async (user: any): Promise<SerializedUser> => {
  const customRole =
    user.customRole && typeof user.customRole === 'object' && '_id' in user.customRole
      ? {
          id: String(user.customRole._id),
          name: user.customRole.name,
          description: user.customRole.description,
          permissions: user.customRole.permissions,
        }
      : null;

  const effectivePermissions = customRole?.permissions ?? getDefaultPermissions(user.role);
  const organizationAssignments = await getResolvedOrganizationAssignmentsForUser(
    String(user._id)
  );
  const adminScopes = deriveAdminScopes(effectivePermissions, organizationAssignments);
  const visibleAdminModules = deriveVisibleAdminModules(
    effectivePermissions,
    organizationAssignments
  );
  const scopedAdminModulesByOrganization =
    deriveScopedAdminModulesByOrganization(organizationAssignments);

  return {
    id: String(user._id),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    baseRoleLabel: getSystemRoleLabel(user.role),
    customRoleId:
      user.customRole && typeof user.customRole === 'object' && '_id' in user.customRole
        ? String(user.customRole._id)
        : user.customRole
          ? String(user.customRole)
          : null,
    customRole,
    effectiveRoleLabel: customRole?.name ?? getSystemRoleLabel(user.role),
    effectiveRoleKind: customRole ? 'custom' : 'system',
    effectivePermissions,
    canAccessAdmin: canAccessAdminPanel(effectivePermissions, organizationAssignments),
    organizationAssignments,
    adminScopes,
    visibleAdminModules,
    scopedAdminModulesByOrganization,
    isActive: user.isActive,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

type OrganizationAssignmentInput = {
  organizationId: string;
  roleId: string;
};

const ensureProtectedFieldsAbsent = (body: Record<string, unknown>) => {
  const invalidFields = PROTECTED_USER_FIELDS.filter((field) => field in body);
  if (invalidFields.length > 0) {
    throw new AppError(
      `Protected fields cannot be changed via this endpoint: ${invalidFields.join(', ')}`,
      400
    );
  }
};

const ensureCanRevokeFullAdmin = async (targetUser: any) => {
  if (targetUser.role !== UserRole.FULL_ADMIN || !targetUser.isActive) {
    return;
  }

  const activeFullAdminCount = await findActiveFullAdminCount();
  if (activeFullAdminCount <= 1) {
    throw new AppError('You cannot remove access from the last active full admin', 400);
  }
};

const validateAssignableRole = async (
  req: AuthRequest,
  role?: UserRole,
  customRoleId?: string | null
) => {
  if (!req.user) {
    throw new AppError('User not authenticated', 401);
  }

  const includesRoleFields = role !== undefined || customRoleId !== undefined;
  if (!includesRoleFields) {
    return { role: undefined, customRoleId: undefined };
  }

  if (!hasGlobalPermission(req.user, Permission.ASSIGN_ROLE)) {
    throw new AppError('You do not have permission to assign roles', 403);
  }

  let validatedCustomRoleId: string | null | undefined = customRoleId;
  if (customRoleId !== undefined && customRoleId !== null) {
    const customRole = await Role.findById(customRoleId);
    if (!customRole) {
      throw new AppError('Custom role not found', 404);
    }
    if (customRole.isSystemRole) {
      throw new AppError('System roles cannot be assigned as custom role overrides', 400);
    }

    ensurePermissionSetWithinActorScope(
      req.user.permissions,
      customRole.permissions ?? [],
      'You cannot assign a custom role with permissions beyond your own global scope'
    );

    validatedCustomRoleId = String(customRole._id);
  }

  if (role !== undefined) {
    ensurePermissionSetWithinActorScope(
      req.user.permissions,
      getDefaultPermissions(role),
      'You cannot assign a base system role with permissions beyond your own global scope'
    );
  }

  return {
    role,
    customRoleId: validatedCustomRoleId,
  };
};

const validateOrganizationAssignments = async (
  assignments: OrganizationAssignmentInput[] | undefined,
  req: AuthRequest
) => {
  if (!assignments || assignments.length === 0) {
    return [];
  }

  if (!req.user || !hasGlobalPermission(req.user, Permission.ASSIGN_ROLE)) {
    throw new AppError('You do not have permission to assign organization-scoped roles', 403);
  }
  const actor = req.user;

  const seenOrganizations = new Set<string>();

  return Promise.all(
    assignments.map(async (assignment) => {
      const organizationId = assignment.organizationId?.trim().toLowerCase();
      if (!organizationId) {
        throw new AppError('organizationId is required for organization assignments', 400);
      }

      if (seenOrganizations.has(organizationId)) {
        throw new AppError('Each organization can only be assigned once per user', 400);
      }
      seenOrganizations.add(organizationId);

      const [organization, role] = await Promise.all([
        Organization.findOne({ id: organizationId }).select('id'),
        Role.findById(assignment.roleId),
      ]);

      if (!organization) {
        throw new AppError(`Organization not found: ${organizationId}`, 404);
      }

      if (!role) {
        throw new AppError('Organization assignment role not found', 404);
      }

      if (role.isSystemRole) {
        throw new AppError('Built-in system roles cannot be used for organization assignments', 400);
      }

      ensurePermissionSetWithinActorScope(
        actor.permissions,
        role.permissions ?? [],
        'You cannot assign an organization-scoped role with permissions beyond your own global scope'
      );

      return {
        organizationId,
        roleId: String(role._id),
      };
    })
  );
};

/**
 * Create a new admin CMS user
 */
export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName } = req.body;
    const role = req.body.role as UserRole | undefined;
    const customRoleId = req.body.customRoleId as string | null | undefined;
    const organizationAssignments = req.body.organizationAssignments as
      | OrganizationAssignmentInput[]
      | undefined;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    const assignment = await validateAssignableRole(req, role, customRoleId);
    const validatedOrganizationAssignments = await validateOrganizationAssignments(
      organizationAssignments,
      req
    );

    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      role: assignment.role || UserRole.SUPPORT,
      customRole: assignment.customRoleId || undefined,
      isActive: true,
    });

    if (validatedOrganizationAssignments.length > 0) {
      await OrganizationAssignment.insertMany(
        validatedOrganizationAssignments.map((scopedAssignment) => ({
          user: user._id,
          organizationId: scopedAssignment.organizationId,
          role: scopedAssignment.roleId,
        }))
      );
    }

    const populatedUser = await User.findById(user._id)
      .select('-password')
      .populate('customRole', 'name description permissions');

    logger.info(`User created: ${user.email} by user ${req.user?.userId}`);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: populatedUser ? await serializeUser(populatedUser) : await serializeUser(user),
      },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Get all users
 */
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, role, isActive, customRoleId } = req.query;

    const query: any = {};
    const normalizedRole =
      typeof role === 'string' && role.trim().length > 0 ? role.trim() : null;
    const normalizedIsActive =
      isActive === 'true' || isActive === 'false' ? isActive : null;
    const normalizedCustomRoleId =
      typeof customRoleId === 'string' && customRoleId.trim().length > 0
        ? customRoleId.trim()
        : null;

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (normalizedRole) {
      query.role = normalizedRole;
    }

    if (normalizedIsActive) {
      query.isActive = normalizedIsActive === 'true';
    }

    if (normalizedCustomRoleId) {
      query.customRole = normalizedCustomRoleId;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .populate('customRole', 'name description permissions')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: await Promise.all(users.map((user) => serializeUser(user))),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select('-password')
      .populate('customRole', 'name description permissions');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      success: true,
      data: { user: await serializeUser(user) },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Update non-privileged user account fields
 */
export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    ensureProtectedFieldsAbsent(req.body);

    const updates: Record<string, string> = {};
    if (typeof req.body.firstName === 'string') {
      updates.firstName = req.body.firstName;
    }
    if (typeof req.body.lastName === 'string') {
      updates.lastName = req.body.lastName;
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .select('-password')
      .populate('customRole', 'name description permissions');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    logger.info(`User updated: ${id} by user ${req.user?.userId}`);

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: { user: await serializeUser(user) },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Update a user's system role/custom role
 */
export const updateUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const role = req.body.role as UserRole | undefined;
    const customRoleId = req.body.customRoleId as string | null | undefined;

    if (role === undefined && customRoleId === undefined) {
      throw new AppError('At least one of role or customRoleId must be provided', 400);
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      throw new AppError('User not found', 404);
    }

    const assignment = await validateAssignableRole(req, role, customRoleId);

    if (role !== undefined && role !== targetUser.role) {
      await ensureCanRevokeFullAdmin(targetUser);
      targetUser.role = role;
    }

    if (customRoleId !== undefined) {
      targetUser.customRole = assignment.customRoleId
        ? new Types.ObjectId(assignment.customRoleId)
        : undefined;
    }

    await targetUser.save();

    const populatedUser = await User.findById(id)
      .select('-password')
      .populate('customRole', 'name description permissions');

    logger.info(`Role updated for user: ${id} by user ${req.user?.userId}`);

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: {
        user: populatedUser ? await serializeUser(populatedUser) : await serializeUser(targetUser),
      },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Activate/deactivate a user
 */
export const updateUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body as { isActive: boolean };

    if (req.user?.userId === id && isActive === false) {
      throw new AppError('You cannot deactivate your own account', 400);
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.role === UserRole.FULL_ADMIN && user.isActive && isActive === false) {
      await ensureCanRevokeFullAdmin(user);
    }

    user.isActive = isActive;
    await user.save();

    const populatedUser = await User.findById(id)
      .select('-password')
      .populate('customRole', 'name description permissions');

    logger.info(`User status updated: ${id} by user ${req.user?.userId}`);

    res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { user: populatedUser ? await serializeUser(populatedUser) : await serializeUser(user) },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Delete user
 */
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (req.user?.userId === id) {
      throw new AppError('You cannot delete your own account', 400);
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    await ensureCanRevokeFullAdmin(user);
    await user.deleteOne();
    await OrganizationAssignment.deleteMany({ user: id });

    logger.info(`User deleted: ${id} by user ${req.user?.userId}`);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    throw error;
  }
};

export const getUserOrgAssignments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('_id');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const assignments = await getResolvedOrganizationAssignmentsForUser(id);

    res.status(200).json({
      success: true,
      data: { assignments },
    });
  } catch (error) {
    throw error;
  }
};

export const createUserOrgAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('_id');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const [assignment] = await validateOrganizationAssignments([req.body], req);

    const existingAssignment = await OrganizationAssignment.findOne({
      user: id,
      organizationId: assignment.organizationId,
    });
    if (existingAssignment) {
      throw new AppError('This user already has an assignment for that organization', 409);
    }

    const createdAssignment = await OrganizationAssignment.create({
      user: id,
      organizationId: assignment.organizationId,
      role: assignment.roleId,
    });

    const assignments = await getResolvedOrganizationAssignmentsForUser(id);
    const created = assignments.find((item) => item.id === String(createdAssignment._id));

    logger.info(`Organization assignment created for user: ${id} by user ${req.user?.userId}`);

    res.status(201).json({
      success: true,
      message: 'Organization assignment created successfully',
      data: { assignment: created ?? null, assignments },
    });
  } catch (error) {
    throw error;
  }
};

export const updateUserOrgAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, assignmentId } = req.params;
    const assignment = await OrganizationAssignment.findOne({ _id: assignmentId, user: id });

    if (!assignment) {
      throw new AppError('Organization assignment not found', 404);
    }

    const [validatedAssignment] = await validateOrganizationAssignments([req.body], req);

    if (validatedAssignment.organizationId !== assignment.organizationId) {
      const existingAssignment = await OrganizationAssignment.findOne({
        user: id,
        organizationId: validatedAssignment.organizationId,
      });
      if (existingAssignment) {
        throw new AppError('This user already has an assignment for that organization', 409);
      }
    }

    assignment.organizationId = validatedAssignment.organizationId;
    assignment.role = validatedAssignment.roleId as any;
    await assignment.save();

    const assignments = await getResolvedOrganizationAssignmentsForUser(id);
    const updated = assignments.find((item) => item.id === assignmentId);

    logger.info(`Organization assignment updated for user: ${id} by user ${req.user?.userId}`);

    res.status(200).json({
      success: true,
      message: 'Organization assignment updated successfully',
      data: { assignment: updated ?? null, assignments },
    });
  } catch (error) {
    throw error;
  }
};

export const deleteUserOrgAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, assignmentId } = req.params;
    const assignment = await OrganizationAssignment.findOneAndDelete({ _id: assignmentId, user: id });

    if (!assignment) {
      throw new AppError('Organization assignment not found', 404);
    }

    const assignments = await getResolvedOrganizationAssignmentsForUser(id);

    logger.info(`Organization assignment deleted for user: ${id} by user ${req.user?.userId}`);

    res.status(200).json({
      success: true,
      message: 'Organization assignment deleted successfully',
      data: { assignments },
    });
  } catch (error) {
    throw error;
  }
};
