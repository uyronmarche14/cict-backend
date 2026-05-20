import { Response } from 'express';
import Announcement from '../models/Announcement';
import Event from '../models/Event';
import News from '../models/News';
import Organization from '../models/Organization';
import Role from '../models/Role';
import Student from '../models/Student';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { Permission } from '../types';
import { getAccessibleOrganizationIdsForAuthenticatedUser } from '../utils/organizationScope';
import { hasGlobalPermission } from '../utils/rbac';

type DashboardCardKey =
  | 'users'
  | 'students'
  | 'news'
  | 'announcements'
  | 'roles'
  | 'organizations'
  | 'events';

export const getDashboardSummary = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    throw new AppError('User not authenticated', 401);
  }
  const currentUser = req.user;

  const scopedOrganizationIdsByPermission = new Map<Permission, string[]>();
  const getScopedOrganizationIds = (permission: Permission) => {
    if (!scopedOrganizationIdsByPermission.has(permission)) {
      scopedOrganizationIdsByPermission.set(
        permission,
        getAccessibleOrganizationIdsForAuthenticatedUser(currentUser, permission)
      );
    }

    return scopedOrganizationIdsByPermission.get(permission) ?? [];
  };

  const hasScopedModuleAccess = (permission: Permission) =>
    getScopedOrganizationIds(permission).length > 0;

  const visibleModules = (currentUser.visibleAdminModules ?? []).filter(
    (module): module is DashboardCardKey => module !== 'dashboard' && module !== 'faq'
  );

  const countTasks: Partial<Record<DashboardCardKey, Promise<number>>> = {};

  if (hasGlobalPermission(currentUser, Permission.VIEW_USERS)) {
    countTasks.users = User.countDocuments();
  }
  if (hasGlobalPermission(currentUser, Permission.VIEW_STUDENT)) {
    countTasks.students = Student.countDocuments();
  }
  if (hasGlobalPermission(currentUser, Permission.VIEW_NEWS)) {
    countTasks.news = News.countDocuments();
  } else if (hasScopedModuleAccess(Permission.VIEW_NEWS)) {
    countTasks.news = News.countDocuments({
      ownerType: 'organization',
      organizationId: { $in: getScopedOrganizationIds(Permission.VIEW_NEWS) },
    });
  }
  if (hasGlobalPermission(currentUser, Permission.VIEW_ANNOUNCEMENT)) {
    countTasks.announcements = Announcement.countDocuments();
  } else if (hasScopedModuleAccess(Permission.VIEW_ANNOUNCEMENT)) {
    countTasks.announcements = Announcement.countDocuments({
      ownerType: 'organization',
      organizationId: { $in: getScopedOrganizationIds(Permission.VIEW_ANNOUNCEMENT) },
    });
  }
  if (hasGlobalPermission(currentUser, Permission.VIEW_ROLE)) {
    countTasks.roles = Role.countDocuments();
  }
  if (hasGlobalPermission(currentUser, Permission.VIEW_ORGANIZATION)) {
    countTasks.organizations = Organization.countDocuments();
  } else {
    const scopedOrganizationIds = Object.entries(
      currentUser.scopedAdminModulesByOrganization ?? {}
    )
      .filter(([, modules]) => modules.includes('organizations'))
      .map(([organizationId]) => organizationId);

    if (scopedOrganizationIds.length > 0) {
      countTasks.organizations = Organization.countDocuments({
        id: { $in: scopedOrganizationIds },
      });
    }
  }
  if (hasGlobalPermission(currentUser, Permission.VIEW_EVENT)) {
    countTasks.events = Event.countDocuments();
  } else if (hasScopedModuleAccess(Permission.VIEW_EVENT)) {
    countTasks.events = Event.countDocuments({
      ownerType: 'organization',
      organizationId: { $in: getScopedOrganizationIds(Permission.VIEW_EVENT) },
    });
  }

  const resolvedCounts = await Promise.all(
    Object.entries(countTasks).map(async ([key, task]) => [key, await task] as const)
  );

  const cards = {
    users: 0,
    students: 0,
    news: 0,
    announcements: 0,
    roles: 0,
    organizations: 0,
    events: 0,
  };

  for (const [key, count] of resolvedCounts) {
    cards[key as DashboardCardKey] = count;
  }

  res.status(200).json({
    success: true,
    data: {
      cards,
      visibleModules,
    },
  });
};
