import { Request, Response } from 'express';
import Role from '../models/Role';
import User from '../models/User';
import OrganizationAssignment from '../models/OrganizationAssignment';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { getSystemRoleCatalog } from '../utils/rbac';
import { Permission, UserRole } from '../types';

const ensureRolePermissionsWithinActorScope = (
  actorPermissions: Permission[],
  requestedPermissions: Permission[]
) => {
  const unauthorizedPermissions = requestedPermissions.filter(
    (permission) => !actorPermissions.includes(permission)
  );

  if (unauthorizedPermissions.length > 0) {
    throw new AppError(
      `You cannot manage a custom role with permissions beyond your own global scope: ${unauthorizedPermissions.join(', ')}`,
      403
    );
  }
};

const serializeCustomRole = async (role: any) => {
  const [assignedUserCount, assignedOrgCount] = await Promise.all([
    User.countDocuments({ customRole: role._id }),
    OrganizationAssignment.countDocuments({ role: role._id }),
  ]);

  return {
    id: String(role._id),
    name: role.name,
    description: role.description,
    kind: 'custom' as const,
    isEditable: true,
    isDeletable: true,
    permissions: role.permissions ?? [],
    assignedUserCount: assignedUserCount + assignedOrgCount,
    createdBy: role.createdBy
      ? {
          id: String(role.createdBy._id ?? role.createdBy),
          firstName: role.createdBy.firstName,
          lastName: role.createdBy.lastName,
          email: role.createdBy.email,
        }
      : null,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
};

const serializeSystemRole = async (
  systemRole: ReturnType<typeof getSystemRoleCatalog>[number]
) => {
  const assignedUserCount = await User.countDocuments({ role: systemRole.systemRoleKey });

  return {
    id: systemRole.id,
    name: systemRole.name,
    description: systemRole.description,
    kind: 'system' as const,
    isEditable: false,
    isDeletable: false,
    permissions: systemRole.permissions,
    systemRoleKey: systemRole.systemRoleKey,
    assignedUserCount,
    createdBy: null,
    createdAt: null,
    updatedAt: null,
  };
};

const isSystemRoleIdentifier = (id: string): id is `system:${string}` => id.startsWith('system:');

const findSystemRoleById = (id: string) =>
  getSystemRoleCatalog().find((role) => role.id === id || role.systemRoleKey === (id as UserRole));

/**
 * Create new role
 */
export const createRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }
    
    const { name, description, permissions } = req.body;
    const requestedPermissions = Array.isArray(permissions) ? permissions : [];
    ensureRolePermissionsWithinActorScope(req.user.permissions, requestedPermissions);
    
    const role = await Role.create({
      name,
      description,
      permissions: requestedPermissions,
      createdBy: req.user.userId,
    });
    
    logger.info(`Role created: ${role._id} by user ${req.user.userId}`);
    const serializedRole = await serializeCustomRole(role);
    
    res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: { role: serializedRole },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Get all roles
 */
export const getAllRoles = async (_req: Request, res: Response): Promise<void> => {
  try {
    const customRoles = await Role.find({ isSystemRole: false })
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    const [systemRoles, serializedCustomRoles] = await Promise.all([
      Promise.all(getSystemRoleCatalog().map((role) => serializeSystemRole(role))),
      Promise.all(customRoles.map((role) => serializeCustomRole(role))),
    ]);
    const roles = [...systemRoles, ...serializedCustomRoles];
    
    res.status(200).json({
      success: true,
      data: { roles },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Get role by ID
 */
export const getRoleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (isSystemRoleIdentifier(id) || findSystemRoleById(id)) {
      const systemRole = findSystemRoleById(id);

      if (!systemRole) {
        throw new AppError('Role not found', 404);
      }

      res.status(200).json({
        success: true,
        data: { role: await serializeSystemRole(systemRole) },
      });
      return;
    }
    
    const role = await Role.findById(id).populate('createdBy', 'firstName lastName email');
    
    if (!role) {
      throw new AppError('Role not found', 404);
    }
    
    res.status(200).json({
      success: true,
      data: { role: await serializeCustomRole(role) },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Update role
 */
export const updateRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, permissions } = req.body;
    
    const role = await Role.findById(id);
    
    if (!role) {
      throw new AppError('Role not found', 404);
    }
    
    // Prevent updating system roles
    if (role.isSystemRole) {
      throw new AppError('Cannot update system roles', 403);
    }
    
    const requestedPermissions = Array.isArray(permissions)
      ? permissions
      : role.permissions ?? [];
    ensureRolePermissionsWithinActorScope(req.user?.permissions ?? [], requestedPermissions);
    
    const updates: any = {};
    if (name) {updates.name = name;}
    if (description) {updates.description = description;}
    if (permissions) {updates.permissions = requestedPermissions;}
    
    const updatedRole = await Role.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName email');
    
    logger.info(`Role updated: ${id} by user ${req.user?.userId}`);
    
    res.status(200).json({
      success: true,
      message: 'Role updated successfully',
      data: { role: updatedRole ? await serializeCustomRole(updatedRole) : null },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Delete role
 */
export const deleteRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const role = await Role.findById(id);
    
    if (!role) {
      throw new AppError('Role not found', 404);
    }
    
    // Prevent deleting system roles
    if (role.isSystemRole) {
      throw new AppError('Cannot delete system roles', 403);
    }

    const [assignedUserCount, assignedOrgCount] = await Promise.all([
      User.countDocuments({ customRole: role._id }),
      OrganizationAssignment.countDocuments({ role: role._id }),
    ]);
    if (assignedUserCount > 0 || assignedOrgCount > 0) {
      throw new AppError(
        'Cannot delete a custom role that is still assigned to users or organization scopes. Reassign or remove it first.',
        409
      );
    }
    
    await role.deleteOne();
    
    logger.info(`Role deleted: ${id} by user ${req.user?.userId}`);
    
    res.status(200).json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    throw error;
  }
};
