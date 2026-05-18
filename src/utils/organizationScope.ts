import Organization from '../models/Organization';
import OrganizationAssignment from '../models/OrganizationAssignment';
import { AppError } from '../middleware/errorHandler';
import {
  ContentOwnerType,
  IAuthenticatedUser,
  IResolvedOrganizationAssignment,
  Permission,
} from '../types';
import { hasGlobalPermission } from './rbac';

type OwnershipInput = {
  ownerType?: unknown;
  organizationId?: unknown;
};

const normalizeOrganizationId = (organizationId?: unknown): string | null => {
  if (typeof organizationId !== 'string') {
    return null;
  }

  const normalized = organizationId.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

export const resolveOwnershipInput = ({
  ownerType,
  organizationId,
}: OwnershipInput): {
  ownerType: ContentOwnerType;
  organizationId: string | null;
} => {
  const normalizedOwnerType =
    ownerType === ContentOwnerType.ORGANIZATION
      ? ContentOwnerType.ORGANIZATION
      : ContentOwnerType.SYSTEM;

  return {
    ownerType: normalizedOwnerType,
    organizationId: normalizeOrganizationId(organizationId),
  };
};

export const validateOwnershipPair = async (
  ownerType: ContentOwnerType,
  organizationId: string | null
): Promise<void> => {
  if (ownerType === ContentOwnerType.SYSTEM) {
    if (organizationId) {
      throw new AppError('System-owned content cannot include an organizationId', 400);
    }

    return;
  }

  if (!organizationId) {
    throw new AppError('organizationId is required for organization-owned content', 400);
  }

  const organizationExists = await Organization.exists({ id: organizationId });
  if (!organizationExists) {
    throw new AppError('Organization not found', 404);
  }
};

export const serializeOrganizationAssignment = (assignment: {
  _id?: unknown;
  id?: unknown;
  organizationId: string;
  role: {
    _id?: unknown;
    id?: unknown;
    name: string;
    permissions: Permission[];
  };
  organizationName?: string;
}): IResolvedOrganizationAssignment => ({
  id: String(assignment._id ?? assignment.id),
  organizationId: assignment.organizationId,
  organizationName: assignment.organizationName,
  roleId: String(assignment.role._id ?? assignment.role.id),
  roleName: assignment.role.name,
  permissions: assignment.role.permissions ?? [],
});

export const getResolvedOrganizationAssignmentsForUser = async (
  userId: string
): Promise<IResolvedOrganizationAssignment[]> => {
  const assignments = await OrganizationAssignment.find({ user: userId })
    .populate('role', 'name permissions isSystemRole')
    .lean();

  if (assignments.length === 0) {
    return [];
  }

  const organizationIds = assignments.map((assignment) => assignment.organizationId);
  const organizations = await Organization.find({ id: { $in: organizationIds } })
    .select('id name')
    .lean();
  const organizationNameById = new Map(
    organizations.map((organization) => [organization.id, organization.name])
  );

  return assignments
    .filter(
      (assignment) =>
        assignment.role &&
        typeof assignment.role === 'object' &&
        !('isSystemRole' in assignment.role && assignment.role.isSystemRole)
    )
    .map((assignment) =>
      serializeOrganizationAssignment({
        _id: assignment._id,
        organizationId: assignment.organizationId,
        organizationName: organizationNameById.get(assignment.organizationId),
        role: assignment.role as {
          _id?: unknown;
          name: string;
          permissions: Permission[];
        },
      })
    );
};

export const getAccessibleOrganizationIdsForPermission = async (
  userId: string,
  permission: Permission
): Promise<string[]> => {
  const assignments = await getResolvedOrganizationAssignmentsForUser(userId);

  return assignments
    .filter((assignment) => assignment.permissions.includes(permission))
    .map((assignment) => assignment.organizationId);
};

export const getAccessibleOrganizationIdsFromAssignments = (
  assignments: IResolvedOrganizationAssignment[] = [],
  permission?: Permission
): string[] => {
  const filteredAssignments = permission
    ? assignments.filter((assignment) => assignment.permissions.includes(permission))
    : assignments;

  return filteredAssignments.map((assignment) => assignment.organizationId);
};

export const getAccessibleOrganizationIdsForAuthenticatedUser = (
  user: Pick<IAuthenticatedUser, 'organizationAssignments'>,
  permission?: Permission
): string[] =>
  getAccessibleOrganizationIdsFromAssignments(user.organizationAssignments ?? [], permission);

export const hasScopedOrganizationPermissionForUser = (
  user: Pick<IAuthenticatedUser, 'organizationAssignments'>,
  organizationId: string,
  permission: Permission
): boolean =>
  getAccessibleOrganizationIdsForAuthenticatedUser(user, permission).includes(organizationId);

export const canAccessOrganizationScope = (
  user: Pick<IAuthenticatedUser, 'permissions' | 'organizationAssignments'>,
  organizationId: string,
  permission: Permission
): boolean =>
  hasGlobalPermission(user, permission) ||
  hasScopedOrganizationPermissionForUser(user, organizationId, permission);

export const hasScopedOrganizationPermission = async (
  userId: string,
  organizationId: string,
  permission: Permission
): Promise<boolean> => {
  const accessibleOrganizationIds = await getAccessibleOrganizationIdsForPermission(userId, permission);
  return accessibleOrganizationIds.includes(organizationId);
};

export const canManageOwnedContent = async (
  user: IAuthenticatedUser,
  permission: Permission,
  ownerType: ContentOwnerType,
  organizationId: string | null
): Promise<boolean> => {
  if (hasGlobalPermission(user, permission)) {
    return true;
  }

  if (ownerType === ContentOwnerType.SYSTEM || !organizationId) {
    return false;
  }

  return hasScopedOrganizationPermissionForUser(user, organizationId, permission);
};

export const ensureCanManageOwnedContent = async (
  user: IAuthenticatedUser | undefined,
  permission: Permission,
  ownerType: ContentOwnerType,
  organizationId: string | null
): Promise<void> => {
  if (!user) {
    throw new AppError('User not authenticated', 401);
  }

  const allowed = await canManageOwnedContent(user, permission, ownerType, organizationId);
  if (!allowed) {
    throw new AppError('You do not have access to manage content for this scope', 403);
  }
};

export const canReassignOwnership = async (
  user: IAuthenticatedUser,
  currentOwnerType: ContentOwnerType,
  currentOrganizationId: string | null,
  nextOwnerType: ContentOwnerType,
  nextOrganizationId: string | null,
  permission: Permission
): Promise<boolean> => {
  if (
    currentOwnerType === nextOwnerType &&
    currentOrganizationId === nextOrganizationId
  ) {
    return true;
  }

  if (!hasGlobalPermission(user, permission)) {
    return false;
  }

  if (nextOwnerType === ContentOwnerType.ORGANIZATION && nextOrganizationId) {
    await validateOwnershipPair(nextOwnerType, nextOrganizationId);
  }

  return true;
};
