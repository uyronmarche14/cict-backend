import Role from '../models/Role';
import User from '../models/User';
import { getResolvedOrganizationAssignmentsForUser } from './organizationScope';
import {
  AdminModule,
  IAdminScopes,
  IAuthenticatedUser,
  IResolvedOrganizationAssignment,
  IScopedAdminModulesByOrganization,
  IUser,
  Permission,
  UserRole,
} from '../types';

export interface SystemRoleDefinition {
  systemRoleKey: UserRole;
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface SerializedAuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  baseRoleLabel: string;
  customRoleId: string | null;
  customRole: {
    id: string;
    name: string;
    description: string;
    permissions: Permission[];
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
}

export const SYSTEM_ROLE_DEFINITIONS: SystemRoleDefinition[] = [
  {
    systemRoleKey: UserRole.FULL_ADMIN,
    id: 'system:full_admin',
    name: 'Full Admin',
    description: 'Full administrative access to all protected CMS modules and settings.',
    permissions: Object.values(Permission),
  },
  {
    systemRoleKey: UserRole.SEMI_ADMIN,
    id: 'system:semi_admin',
    name: 'Semi Admin',
    description:
      'Elevated access for managing users, content, organizations, and members without full system control.',
    permissions: [
      Permission.VIEW_USERS,
      Permission.EDIT_USER,
      Permission.SET_USER_STATUS,
      Permission.VIEW_NEWS,
      Permission.CREATE_NEWS,
      Permission.EDIT_NEWS,
      Permission.PUBLISH_NEWS,
      Permission.ARCHIVE_NEWS,
      Permission.VIEW_ANNOUNCEMENT,
      Permission.CREATE_ANNOUNCEMENT,
      Permission.EDIT_ANNOUNCEMENT,
      Permission.PUBLISH_ANNOUNCEMENT,
      Permission.ARCHIVE_ANNOUNCEMENT,
      Permission.VIEW_EVENT,
      Permission.CREATE_EVENT,
      Permission.EDIT_EVENT,
      Permission.PUBLISH_EVENT,
      Permission.CANCEL_EVENT,
      Permission.COMPLETE_EVENT,
      Permission.VIEW_ORGANIZATION,
      Permission.CREATE_ORGANIZATION,
      Permission.EDIT_ORGANIZATION,
      Permission.VIEW_MEMBER,
      Permission.CREATE_MEMBER,
      Permission.EDIT_MEMBER,
      Permission.DELETE_MEMBER,
      Permission.VIEW_ROLE,
      Permission.MANAGE_SETTINGS,
    ],
  },
  {
    systemRoleKey: UserRole.SUPPORT,
    id: 'system:support',
    name: 'Support',
    description: 'Base support account classification with no implicit global admin access.',
    permissions: [],
  },
];

export const getSystemRoleDefinition = (role: UserRole): SystemRoleDefinition => {
  const definition = SYSTEM_ROLE_DEFINITIONS.find(
    (systemRole) => systemRole.systemRoleKey === role
  );

  if (!definition) {
    throw new Error(`Unsupported system role: ${role}`);
  }

  return definition;
};

export const getDefaultPermissions = (role: UserRole): Permission[] =>
  getSystemRoleDefinition(role).permissions;

export const getSystemRoleCatalog = (): SystemRoleDefinition[] => SYSTEM_ROLE_DEFINITIONS;

export const ADMIN_ENTRY_PERMISSIONS: Permission[] = [
  Permission.VIEW_USERS,
  Permission.VIEW_STUDENT,
  Permission.VIEW_ACADEMIC_GROUPS,
  Permission.VIEW_ROLE,
  Permission.VIEW_ORGANIZATION,
  Permission.VIEW_MEMBER,
  Permission.VIEW_NEWS,
  Permission.VIEW_ANNOUNCEMENT,
  Permission.VIEW_EVENT,
  Permission.VIEW_PROCESS,
  Permission.MANAGE_SETTINGS,
];

export const ORGANIZATION_MANAGEMENT_PERMISSIONS: Permission[] = [
  Permission.VIEW_ORGANIZATION,
  Permission.CREATE_ORGANIZATION,
  Permission.EDIT_ORGANIZATION,
  Permission.DELETE_ORGANIZATION,
  Permission.VIEW_MEMBER,
  Permission.CREATE_MEMBER,
  Permission.EDIT_MEMBER,
  Permission.DELETE_MEMBER,
  Permission.MANAGE_MEMBER_ROLES,
];

const ADMIN_MODULE_PERMISSION_MAP: Record<Exclude<AdminModule, 'dashboard'>, Permission[]> = {
  organizations: ORGANIZATION_MANAGEMENT_PERMISSIONS,
  users: [
    Permission.VIEW_USERS,
    Permission.CREATE_USER,
    Permission.EDIT_USER,
    Permission.DELETE_USER,
    Permission.SET_USER_STATUS,
  ],
  students: [
    Permission.VIEW_STUDENT,
    Permission.CREATE_STUDENT,
    Permission.EDIT_STUDENT,
    Permission.SET_STUDENT_STATUS,
    Permission.VIEW_ACADEMIC_GROUPS,
    Permission.MANAGE_ACADEMIC_GROUPS,
  ],
  events: [
    Permission.VIEW_EVENT,
    Permission.CREATE_EVENT,
    Permission.EDIT_EVENT,
    Permission.DELETE_EVENT,
    Permission.PUBLISH_EVENT,
    Permission.CANCEL_EVENT,
    Permission.COMPLETE_EVENT,
  ],
  news: [
    Permission.VIEW_NEWS,
    Permission.CREATE_NEWS,
    Permission.EDIT_NEWS,
    Permission.DELETE_NEWS,
    Permission.PUBLISH_NEWS,
    Permission.ARCHIVE_NEWS,
  ],
  announcements: [
    Permission.VIEW_ANNOUNCEMENT,
    Permission.CREATE_ANNOUNCEMENT,
    Permission.EDIT_ANNOUNCEMENT,
    Permission.DELETE_ANNOUNCEMENT,
    Permission.PUBLISH_ANNOUNCEMENT,
    Permission.ARCHIVE_ANNOUNCEMENT,
  ],
  roles: [
    Permission.VIEW_ROLE,
    Permission.CREATE_ROLE,
    Permission.EDIT_ROLE,
    Permission.DELETE_ROLE,
    Permission.ASSIGN_ROLE,
  ],
  faq: [Permission.MANAGE_SETTINGS],
  logs: [Permission.VIEW_LOGS],
  processes: [
    Permission.VIEW_PROCESS,
    Permission.CREATE_PROCESS,
    Permission.EDIT_PROCESS,
    Permission.COMMENT_PROCESS,
    Permission.APPROVE_PROCESS_STEP,
  ],
};

type ScopedAdminModule = Extract<
  AdminModule,
  'organizations' | 'events' | 'news' | 'announcements'
>;

const SCOPED_MODULES: ScopedAdminModule[] = [
  'organizations',
  'events',
  'news',
  'announcements',
];

const assignmentHasAnyPermission = (
  assignment: Pick<IResolvedOrganizationAssignment, 'permissions'>,
  permissionsToCheck: Permission[]
): boolean => assignment.permissions.some((permission) => permissionsToCheck.includes(permission));

const hasPermissionFromList = (
  permissions: Permission[],
  permission: Permission
): boolean => permissions.includes(permission);

export const hasGlobalPermission = (
  userOrPermissions: Pick<IAuthenticatedUser, 'permissions'> | Permission[],
  permission: Permission
): boolean =>
  hasPermissionFromList(
    Array.isArray(userOrPermissions) ? userOrPermissions : userOrPermissions.permissions,
    permission
  );

export const hasAnyGlobalPermission = (
  userOrPermissions: Pick<IAuthenticatedUser, 'permissions'> | Permission[],
  permissionsToCheck: Permission[]
): boolean =>
  permissionsToCheck.some((permission) => hasGlobalPermission(userOrPermissions, permission));

export const deriveAdminScopes = (
  permissions: Permission[],
  organizationAssignments: IResolvedOrganizationAssignment[] = []
): IAdminScopes => ({
  global: hasAnyGlobalPermission(permissions, ADMIN_ENTRY_PERMISSIONS),
  organizations: organizationAssignments
    .filter((assignment) => assignmentHasAnyPermission(assignment, ADMIN_ENTRY_PERMISSIONS))
    .map((assignment) => assignment.organizationId),
});

export const getScopedOrganizationIdsForPermissions = (
  organizationAssignments: IResolvedOrganizationAssignment[] = [],
  permissionsToCheck: Permission[]
): string[] =>
  Array.from(
    new Set(
      organizationAssignments
        .filter((assignment) => assignmentHasAnyPermission(assignment, permissionsToCheck))
        .map((assignment) => assignment.organizationId)
    )
  );

export const canAccessAdminPanel = (
  permissions: Permission[],
  organizationAssignments: IResolvedOrganizationAssignment[] = []
): boolean => {
  const scopes = deriveAdminScopes(permissions, organizationAssignments);
  return scopes.global || scopes.organizations.length > 0;
};

const deriveModulesFromPermissions = (
  permissions: Permission[]
): Array<Exclude<AdminModule, 'dashboard'>> =>
  (Object.entries(ADMIN_MODULE_PERMISSION_MAP) as Array<
    [Exclude<AdminModule, 'dashboard'>, Permission[]]
  >)
    .filter(([, modulePermissions]) =>
      modulePermissions.some((permission) => permissions.includes(permission))
    )
    .map(([module]) => module);

export const deriveScopedAdminModulesByOrganization = (
  organizationAssignments: IResolvedOrganizationAssignment[] = []
): IScopedAdminModulesByOrganization => {
  return organizationAssignments.reduce<IScopedAdminModulesByOrganization>(
    (accumulator, assignment) => {
      const modules = SCOPED_MODULES.filter((module) =>
        assignment.permissions.some((permission) =>
          ADMIN_MODULE_PERMISSION_MAP[module].includes(permission)
        )
      );

      if (modules.length > 0) {
        accumulator[assignment.organizationId] = modules;
      }

      return accumulator;
    },
    {}
  );
};

export const deriveVisibleAdminModules = (
  permissions: Permission[],
  organizationAssignments: IResolvedOrganizationAssignment[] = []
): AdminModule[] => {
  const modules = new Set<AdminModule>();
  const globalModules = deriveModulesFromPermissions(permissions);
  const scopedModulesByOrganization =
    deriveScopedAdminModulesByOrganization(organizationAssignments);

  if (
    globalModules.length > 0 ||
    Object.keys(scopedModulesByOrganization).length > 0 ||
    canAccessAdminPanel(permissions, organizationAssignments)
  ) {
    modules.add('dashboard');
  }

  for (const module of globalModules) {
    modules.add(module);
  }

  for (const scopedModules of Object.values(scopedModulesByOrganization)) {
    for (const module of scopedModules) {
      modules.add(module);
    }
  }

  return Array.from(modules);
};

export const resolvePermissionsForRoleContext = async (
  role: UserRole,
  customRoleId?: string | null
): Promise<Permission[]> => {
  if (customRoleId) {
    const customRole = await Role.findById(customRoleId).select('permissions');
    if (!customRole) {
      throw new Error('Assigned custom role no longer exists');
    }

    return customRole.permissions;
  }

  return getDefaultPermissions(role);
};

const getSystemRoleLabel = (role: UserRole): string => getSystemRoleDefinition(role).name;

const serializeCustomRole = (customRole: {
  _id?: unknown;
  id?: unknown;
  name?: string;
  description?: string;
  permissions?: Permission[];
} | null | undefined) => {
  if (!customRole?.name) {
    return null;
  }

  return {
    id: String(customRole._id ?? customRole.id),
    name: customRole.name,
    description: customRole.description ?? '',
    permissions: customRole.permissions ?? [],
  };
};

const resolveSerializedCustomRole = async (
  user: IUser | IAuthenticatedUser | SerializedAuthUser
): Promise<SerializedAuthUser['customRole']> => {
  if (
    'customRole' in user &&
    typeof user.customRole === 'object' &&
    user.customRole !== null &&
    'name' in user.customRole
  ) {
    return serializeCustomRole(user.customRole);
  }

  const customRoleId =
    'customRoleId' in user
      ? user.customRoleId
      : 'customRole' in user
        ? (typeof user.customRole === 'string'
            ? user.customRole
            : (user.customRole as { toString?: () => string } | undefined)?.toString?.()) ?? null
        : null;

  if (!customRoleId) {
    return null;
  }

  const customRole = await Role.findById(customRoleId).select('name description permissions');
  if (!customRole) {
    return null;
  }

  return serializeCustomRole(customRole);
};

export const buildAuthenticatedUser = async (
  user: IUser
): Promise<IAuthenticatedUser> => {
  const customRoleId =
    (user.customRole as { toString?: () => string } | undefined)?.toString?.() ?? null;
  const customRole = customRoleId
    ? await Role.findById(customRoleId).select('name description permissions')
    : null;

  if (customRoleId && !customRole) {
    throw new Error('Assigned custom role no longer exists');
  }

  const permissions = customRole?.permissions ?? getDefaultPermissions(user.role);
  const serializedCustomRole = serializeCustomRole(customRole);
  const effectiveRoleLabel = serializedCustomRole?.name ?? getSystemRoleLabel(user.role);
  const organizationAssignments = await getResolvedOrganizationAssignmentsForUser(
    String(user._id)
  );
  const adminScopes = deriveAdminScopes(permissions, organizationAssignments);
  const visibleAdminModules = deriveVisibleAdminModules(permissions, organizationAssignments);
  const scopedAdminModulesByOrganization =
    deriveScopedAdminModulesByOrganization(organizationAssignments);

  return {
    userId: String(user._id),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    customRole: customRoleId ?? undefined,
    customRoleDetails: serializedCustomRole,
    permissions,
    baseRoleLabel: getSystemRoleLabel(user.role),
    effectiveRoleLabel,
    effectiveRoleKind: serializedCustomRole ? 'custom' : 'system',
    canAccessAdmin: canAccessAdminPanel(permissions, organizationAssignments),
    adminScopes,
    visibleAdminModules,
    scopedAdminModulesByOrganization,
    organizationAssignments,
    isActive: user.isActive,
  };
};

export const serializeAuthUser = async (
  user: IUser | IAuthenticatedUser | SerializedAuthUser
): Promise<SerializedAuthUser> => {
  const customRole = await resolveSerializedCustomRole(user);
  const inheritedPermissions =
    'permissions' in user && Array.isArray(user.permissions) ? user.permissions : undefined;

  if ('id' in user) {
    const effectivePermissions =
      user.effectivePermissions ??
      inheritedPermissions ??
      customRole?.permissions ??
      getDefaultPermissions(user.role);
    const organizationAssignments = user.organizationAssignments ?? [];
    const adminScopes = user.adminScopes ?? deriveAdminScopes(effectivePermissions, organizationAssignments);
    const visibleAdminModules =
      user.visibleAdminModules ??
      deriveVisibleAdminModules(effectivePermissions, organizationAssignments);
    const scopedAdminModulesByOrganization =
      user.scopedAdminModulesByOrganization ??
      deriveScopedAdminModulesByOrganization(organizationAssignments);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      baseRoleLabel: user.baseRoleLabel ?? getSystemRoleLabel(user.role),
      customRoleId: user.customRoleId,
      customRole,
      effectiveRoleLabel: user.effectiveRoleLabel ?? customRole?.name ?? getSystemRoleLabel(user.role),
      effectiveRoleKind: user.effectiveRoleKind ?? (customRole ? 'custom' : 'system'),
      effectivePermissions,
      canAccessAdmin:
        user.canAccessAdmin ?? canAccessAdminPanel(effectivePermissions, organizationAssignments),
      adminScopes,
      visibleAdminModules,
      scopedAdminModulesByOrganization,
      organizationAssignments,
      isActive: user.isActive,
    };
  }

  if ('userId' in user) {
    const organizationAssignments = user.organizationAssignments ?? [];
    const adminScopes = user.adminScopes ?? deriveAdminScopes(user.permissions, organizationAssignments);
    const visibleAdminModules =
      user.visibleAdminModules ??
      deriveVisibleAdminModules(user.permissions, organizationAssignments);
    const scopedAdminModulesByOrganization =
      user.scopedAdminModulesByOrganization ??
      deriveScopedAdminModulesByOrganization(organizationAssignments);
    return {
      id: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      baseRoleLabel: user.baseRoleLabel ?? getSystemRoleLabel(user.role),
      customRoleId: user.customRole ?? null,
      customRole,
      effectiveRoleLabel: user.effectiveRoleLabel ?? customRole?.name ?? getSystemRoleLabel(user.role),
      effectiveRoleKind: user.effectiveRoleKind ?? (customRole ? 'custom' : 'system'),
      effectivePermissions: user.permissions,
      canAccessAdmin: user.canAccessAdmin,
      adminScopes,
      visibleAdminModules,
      scopedAdminModulesByOrganization,
      organizationAssignments,
      isActive: user.isActive,
    };
  }

  const customRoleId =
    ((user.customRole as { toString?: () => string } | undefined)?.toString?.() ?? null);
  const effectivePermissions = customRole?.permissions ?? getDefaultPermissions(user.role);
  const adminScopes = deriveAdminScopes(effectivePermissions, []);
  const visibleAdminModules = deriveVisibleAdminModules(effectivePermissions, []);
  const scopedAdminModulesByOrganization = deriveScopedAdminModulesByOrganization([]);

  return {
    id: String(user._id),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    baseRoleLabel: getSystemRoleLabel(user.role),
    customRoleId,
    customRole,
    effectiveRoleLabel: customRole?.name ?? getSystemRoleLabel(user.role),
    effectiveRoleKind: customRole ? 'custom' : 'system',
    effectivePermissions,
    canAccessAdmin: canAccessAdminPanel(effectivePermissions),
    adminScopes,
    visibleAdminModules,
    scopedAdminModulesByOrganization,
    organizationAssignments: [],
    isActive: user.isActive,
  };
};

export const findActiveFullAdminCount = async (): Promise<number> =>
  User.countDocuments({ role: UserRole.FULL_ADMIN, isActive: true });
