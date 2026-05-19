import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import ActivityLog from './models/ActivityLog';
import Announcement from './models/Announcement';
import Event from './models/Event';
import FAQContent from './models/FAQContent';
import News from './models/News';
import Organization from './models/Organization';
import OrganizationAssignment from './models/OrganizationAssignment';
import Role from './models/Role';
import User from './models/User';
import { createMediaAssetFingerprint } from './utils/mediaFingerprint';
import {
  AnnouncementPriority,
  AnnouncementType,
  EventStatus,
  NewsStatus,
  Permission,
  UserRole,
} from './types';

let app: any;
let mongoServer: MongoMemoryServer | undefined;

const TEST_PASSWORD = 'Password1';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForMongoConnection = async () => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (mongoose.connection.readyState === 1) {
      return;
    }

    await wait(50);
  }

  throw new Error('MongoDB connection did not become ready in time');
};

const signToken = (user: { _id: unknown; email: string; role: UserRole; customRole?: unknown }) =>
  jwt.sign(
    {
      userId: String(user._id),
      email: user.email,
      role: user.role,
      customRole: user.customRole ? String(user.customRole) : undefined,
    },
    process.env.JWT_SECRET as string,
    { expiresIn: '1h' }
  );

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

const createSystemUser = async (overrides?: Partial<{
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
}>) => {
  const user = await User.create({
    email: overrides?.email ?? `user-${new mongoose.Types.ObjectId()}@example.com`,
    password: TEST_PASSWORD,
    firstName: overrides?.firstName ?? 'Test',
    lastName: overrides?.lastName ?? 'User',
    role: overrides?.role ?? UserRole.SUPPORT,
    isActive: overrides?.isActive ?? true,
  });

  return {
    user,
    token: signToken(user),
  };
};

const createPermissionedUser = async (
  permissions: Permission[],
  createdBy: mongoose.Document & { _id: unknown },
  overrides?: Partial<{
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  }>
) => {
  const { user } = await createSystemUser({
    email: overrides?.email,
    firstName: overrides?.firstName,
    lastName: overrides?.lastName,
    role: overrides?.role ?? UserRole.SUPPORT,
  });

  const customRole = await Role.create({
    name: `custom-${new mongoose.Types.ObjectId()}`,
    description: 'Test custom role',
    permissions,
    isSystemRole: false,
    createdBy: createdBy._id,
  });

  user.customRole = customRole._id;
  await user.save();

  return {
    user,
    customRole,
    token: signToken(user),
  };
};

const createScopedUser = async (
  permissions: Permission[],
  organizationId: string,
  createdBy: mongoose.Document & { _id: unknown },
  overrides?: Partial<{
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  }>
) => {
  const { user, token } = await createSystemUser({
    email: overrides?.email,
    firstName: overrides?.firstName,
    lastName: overrides?.lastName,
    role: overrides?.role ?? UserRole.SUPPORT,
  });

  const scopedRole = await Role.create({
    name: `scoped-${new mongoose.Types.ObjectId()}`,
    description: 'Scoped test role',
    permissions,
    isSystemRole: false,
    createdBy: createdBy._id,
  });

  await OrganizationAssignment.create({
    user: user._id,
    organizationId,
    role: scopedRole._id,
  });

  return {
    user,
    scopedRole,
    token,
  };
};

describe('Security-first MVP regression suite', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRE = '1h';
    process.env.BCRYPT_ROUNDS = '4';
    process.env.RATE_LIMIT_MAX_REQUESTS = '10000';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';

    mongoServer = await MongoMemoryServer.create({
      instance: {
        ip: '127.0.0.1',
        port: 27027,
      },
    });
    process.env.MONGODB_URI = mongoServer.getUri();

    app = (await import('./app')).default;
    await waitForMongoConnection();
  });

  afterEach(async () => {
    await Promise.all([
      ActivityLog.deleteMany({}),
      Announcement.deleteMany({}),
      Event.deleteMany({}),
      FAQContent.deleteMany({}),
      News.deleteMany({}),
      Organization.deleteMany({}),
      OrganizationAssignment.deleteMany({}),
      Role.deleteMany({}),
      User.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('rejects protected fields on the general user update endpoint', async () => {
    const { user: fullAdmin } = await createSystemUser({ role: UserRole.FULL_ADMIN });
    const editor = await createPermissionedUser([Permission.EDIT_USER], fullAdmin);
    const target = await createSystemUser({ firstName: 'Original', lastName: 'Person' });

    const response = await request(app)
      .put(`/api/users/${target.user._id}`)
      .set(authHeader(editor.token))
      .send({
        firstName: 'Changed',
        role: UserRole.FULL_ADMIN,
        isActive: false,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'role' }),
        expect.objectContaining({ field: 'isActive' }),
      ])
    );

    const refreshedTarget = await User.findById(target.user._id);
    expect(refreshedTarget?.firstName).toBe('Original');
    expect(refreshedTarget?.role).toBe(UserRole.SUPPORT);
    expect(refreshedTarget?.isActive).toBe(true);
  });

  it('requires explicit permissions for dedicated role and status endpoints', async () => {
    const { user: fullAdmin } = await createSystemUser({ role: UserRole.FULL_ADMIN });
    const editor = await createPermissionedUser([Permission.EDIT_USER], fullAdmin);
    const target = await createSystemUser();

    const roleResponse = await request(app)
      .patch(`/api/users/${target.user._id}/role`)
      .set(authHeader(editor.token))
      .send({ role: UserRole.SEMI_ADMIN });

    expect(roleResponse.status).toBe(403);
    expect(roleResponse.body.message).toBe('You do not have permission to perform this action');

    const statusResponse = await request(app)
      .patch(`/api/users/${target.user._id}/status`)
      .set(authHeader(editor.token))
      .send({ isActive: false });

    expect(statusResponse.status).toBe(403);
    expect(statusResponse.body.message).toBe('You do not have permission to perform this action');
  });

  it('revalidates session state and rejects deactivated or deleted users on the next request', async () => {
    const deactivated = await createSystemUser({ role: UserRole.FULL_ADMIN });

    await User.findByIdAndUpdate(deactivated.user._id, { isActive: false });

    const deactivatedResponse = await request(app)
      .get('/api/auth/profile')
      .set(authHeader(deactivated.token));

    expect(deactivatedResponse.status).toBe(403);
    expect(deactivatedResponse.body.message).toBe('Your account has been deactivated');

    const deleted = await createSystemUser({ role: UserRole.FULL_ADMIN });

    await User.findByIdAndDelete(deleted.user._id);

    const deletedResponse = await request(app)
      .get('/api/auth/profile')
      .set(authHeader(deleted.token));

    expect(deletedResponse.status).toBe(401);
    expect(deletedResponse.body.message).toBe('User no longer exists');
  });

  it('uses cross-site-safe cookie settings in production and clears the same cookie on logout', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalCookieSameSite = process.env.COOKIE_SAME_SITE;
    const originalCookieSecure = process.env.COOKIE_SECURE;
    const originalCookieDomain = process.env.COOKIE_DOMAIN;

    try {
      process.env.NODE_ENV = 'production';
      process.env.COOKIE_SAME_SITE = 'none';
      process.env.COOKIE_SECURE = 'true';
      process.env.COOKIE_DOMAIN = 'cict-backend.onrender.com';

      const loginUser = await createSystemUser({
        role: UserRole.FULL_ADMIN,
        email: 'cookie-user@example.com',
      });

      const loginResponse = await request(app).post('/api/auth/login').send({
        email: loginUser.user.email,
        password: TEST_PASSWORD,
      });

      expect(loginResponse.status).toBe(200);
      const loginCookie = loginResponse.headers['set-cookie']?.[0] ?? '';
      expect(loginCookie).toContain('token=');
      expect(loginCookie).toContain('SameSite=None');
      expect(loginCookie).toContain('Secure');
      expect(loginCookie).toContain('Domain=cict-backend.onrender.com');

      const tokenCookie = loginCookie.split(';')[0];
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Cookie', tokenCookie);
      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.data.user.email).toBe(loginUser.user.email);

      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', tokenCookie);
      expect(logoutResponse.status).toBe(200);
      const clearedCookie = logoutResponse.headers['set-cookie']?.[0] ?? '';
      expect(clearedCookie).toContain('token=');
      expect(clearedCookie).toContain('SameSite=None');
      expect(clearedCookie).toContain('Secure');
      expect(clearedCookie).toContain('Domain=cict-backend.onrender.com');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.COOKIE_SAME_SITE = originalCookieSameSite;
      process.env.COOKIE_SECURE = originalCookieSecure;
      process.env.COOKIE_DOMAIN = originalCookieDomain;
    }
  });

  it('uses the database custom role state instead of stale JWT custom-role data', async () => {
    const { user: fullAdmin } = await createSystemUser({ role: UserRole.FULL_ADMIN });
    const staleRole = await Role.create({
      name: 'Stale publisher',
      description: 'Old global custom role',
      permissions: [Permission.PUBLISH_NEWS],
      isSystemRole: false,
      createdBy: fullAdmin._id,
    });

    const scopedUser = await createSystemUser({
      role: UserRole.SUPPORT,
      email: 'stale-role-user@example.com',
    });

    scopedUser.user.customRole = staleRole._id;
    await scopedUser.user.save();

    const staleToken = signToken(scopedUser.user);

    scopedUser.user.customRole = undefined;
    await scopedUser.user.save();

    const profileResponse = await request(app)
      .get('/api/auth/profile')
      .set(authHeader(staleToken));

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.data.user.customRole).toBeNull();
    expect(profileResponse.body.data.user.effectiveRoleKind).toBe('system');
    expect(profileResponse.body.data.user.effectiveRoleLabel).toBe('Support');
    expect(profileResponse.body.data.user.effectivePermissions).toEqual(
      expect.not.arrayContaining([Permission.PUBLISH_NEWS])
    );
  });

  it('blocks privileged account creation without role-assignment permission and rejects missing custom roles', async () => {
    const { user: fullAdmin } = await createSystemUser({ role: UserRole.FULL_ADMIN });
    const creator = await createPermissionedUser([Permission.CREATE_USER], fullAdmin);

    const privilegedResponse = await request(app)
      .post('/api/users')
      .set(authHeader(creator.token))
      .send({
        email: 'privileged@example.com',
        password: TEST_PASSWORD,
        firstName: 'Privileged',
        lastName: 'Attempt',
        role: UserRole.FULL_ADMIN,
      });

    expect(privilegedResponse.status).toBe(403);
    expect(privilegedResponse.body.message).toBe('You do not have permission to assign roles');

    const assigner = await createPermissionedUser(
      [Permission.CREATE_USER, Permission.ASSIGN_ROLE],
      fullAdmin
    );

    const missingCustomRoleResponse = await request(app)
      .post('/api/users')
      .set(authHeader(assigner.token))
      .send({
        email: 'custom-role@example.com',
        password: TEST_PASSWORD,
        firstName: 'Custom',
        lastName: 'Role',
        customRoleId: new mongoose.Types.ObjectId().toString(),
      });

    expect(missingCustomRoleResponse.status).toBe(404);
    expect(missingCustomRoleResponse.body.message).toBe('Custom role not found');
  });

  it('returns a unified role catalog with built-in system roles and custom roles', async () => {
    const { user: fullAdmin } = await createSystemUser({ role: UserRole.FULL_ADMIN });
    const assigner = await createPermissionedUser([Permission.ASSIGN_ROLE], fullAdmin);
    const customRole = await Role.create({
      name: 'Content Publisher',
      description: 'Publishes content',
      permissions: [Permission.PUBLISH_NEWS, Permission.PUBLISH_ANNOUNCEMENT],
      createdBy: fullAdmin._id,
    });

    const response = await request(app)
      .get('/api/roles')
      .set(authHeader(assigner.token));

    expect(response.status).toBe(200);
    expect(response.body.data.roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'system:full_admin',
          kind: 'system',
          isEditable: false,
          isDeletable: false,
          systemRoleKey: UserRole.FULL_ADMIN,
        }),
        expect.objectContaining({
          id: 'system:semi_admin',
          kind: 'system',
          isEditable: false,
          isDeletable: false,
          systemRoleKey: UserRole.SEMI_ADMIN,
        }),
        expect.objectContaining({
          id: 'system:support',
          kind: 'system',
          isEditable: false,
          isDeletable: false,
          systemRoleKey: UserRole.SUPPORT,
        }),
        expect.objectContaining({
          id: String(customRole._id),
          name: 'Content Publisher',
          kind: 'custom',
          isEditable: true,
          isDeletable: true,
        }),
      ])
    );
  });

  it('serializes effective role details consistently for auth profile and user listings', async () => {
    const { user: fullAdmin } = await createSystemUser({ role: UserRole.FULL_ADMIN });
    const roleManager = await createPermissionedUser(
      [
        Permission.VIEW_USERS,
        Permission.CREATE_USER,
        Permission.ASSIGN_ROLE,
        Permission.PUBLISH_NEWS,
        Permission.PUBLISH_ANNOUNCEMENT,
      ],
      fullAdmin
    );
    const customRole = await Role.create({
      name: 'Publishing Lead',
      description: 'Can publish news and announcements',
      permissions: [Permission.PUBLISH_NEWS, Permission.PUBLISH_ANNOUNCEMENT],
      createdBy: fullAdmin._id,
    });

    const createResponse = await request(app)
      .post('/api/users')
      .set(authHeader(roleManager.token))
      .send({
        email: 'publisher@example.com',
        password: TEST_PASSWORD,
        firstName: 'Publish',
        lastName: 'Lead',
        role: UserRole.SUPPORT,
        customRoleId: String(customRole._id),
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.user.baseRoleLabel).toBe('Support');
    expect(createResponse.body.data.user.customRole.name).toBe('Publishing Lead');
    expect(createResponse.body.data.user.effectiveRoleLabel).toBe('Publishing Lead');
    expect(createResponse.body.data.user.effectiveRoleKind).toBe('custom');
    expect(createResponse.body.data.user.effectivePermissions).toEqual(
      customRole.permissions
    );

    const profileResponse = await request(app)
      .get('/api/auth/profile')
      .set(authHeader(roleManager.token));

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.data.user.baseRoleLabel).toBe('Support');
    expect(profileResponse.body.data.user.effectiveRoleLabel).toBe(
      roleManager.customRole.name
    );
    expect(profileResponse.body.data.user.effectiveRoleKind).toBe('custom');
    expect(profileResponse.body.data.user.customRole.name).toBe(
      roleManager.customRole.name
    );
    expect(profileResponse.body.data.user.effectivePermissions).toEqual(
      roleManager.customRole.permissions
    );

    const usersResponse = await request(app)
      .get('/api/users')
      .set(authHeader(roleManager.token));

    expect(usersResponse.status).toBe(200);
    const createdUser = usersResponse.body.data.users.find(
      (user: { email: string }) => user.email === 'publisher@example.com'
    );
    expect(createdUser.effectiveRoleLabel).toBe('Publishing Lead');
    expect(createdUser.baseRoleLabel).toBe('Support');
    expect(createdUser.effectiveRoleKind).toBe('custom');
    expect(createdUser.customRole.name).toBe('Publishing Lead');
  });

  it('treats empty user filters as unset instead of forcing inactive-only results', async () => {
    const { user: fullAdmin } = await createSystemUser({ role: UserRole.FULL_ADMIN });
    const userViewer = await createPermissionedUser([Permission.VIEW_USERS], fullAdmin);
    const activeUser = await createSystemUser({
      email: 'active-filter@example.com',
      isActive: true,
    });
    const inactiveUser = await createSystemUser({
      email: 'inactive-filter@example.com',
      isActive: false,
    });

    const allUsersResponse = await request(app)
      .get('/api/users?page=1&limit=10&search=&role=&isActive=&customRoleId=')
      .set(authHeader(userViewer.token));

    expect(allUsersResponse.status).toBe(200);
    expect(allUsersResponse.body.data.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: activeUser.user.email }),
        expect.objectContaining({ email: inactiveUser.user.email }),
      ])
    );

    const activeOnlyResponse = await request(app)
      .get('/api/users?page=1&limit=10&isActive=true')
      .set(authHeader(userViewer.token));

    expect(activeOnlyResponse.status).toBe(200);
    expect(activeOnlyResponse.body.data.users.every((user: { isActive: boolean }) => user.isActive)).toBe(true);

    const inactiveOnlyResponse = await request(app)
      .get('/api/users?page=1&limit=10&isActive=false')
      .set(authHeader(userViewer.token));

    expect(inactiveOnlyResponse.status).toBe(200);
    expect(
      inactiveOnlyResponse.body.data.users.every((user: { isActive: boolean }) => !user.isActive)
    ).toBe(true);
  });

  it('prevents status bypasses on general content updates and enforces dedicated workflow permissions', async () => {
    const { user: fullAdmin } = await createSystemUser({ role: UserRole.FULL_ADMIN });
    const newsEditor = await createPermissionedUser(
      [Permission.VIEW_NEWS, Permission.EDIT_NEWS],
      fullAdmin
    );
    const eventEditor = await createPermissionedUser(
      [Permission.VIEW_EVENT, Permission.EDIT_EVENT],
      fullAdmin
    );
    const eventPublisher = await createPermissionedUser(
      [Permission.VIEW_EVENT, Permission.PUBLISH_EVENT],
      fullAdmin
    );

    const news = await News.create({
      title: 'Draft news',
      content: 'Draft content',
      excerpt: 'Draft excerpt',
      author: fullAdmin._id,
      status: NewsStatus.DRAFT,
      tags: [],
    });

    const newsUpdateResponse = await request(app)
      .put(`/api/news/${news._id}`)
      .set(authHeader(newsEditor.token))
      .send({
        title: 'Updated title',
        status: NewsStatus.PUBLISHED,
      });

    expect(newsUpdateResponse.status).toBe(400);
    expect(newsUpdateResponse.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'status' })])
    );

    const event = await Event.create({
      title: 'Draft event',
      description: 'Event description',
      excerpt: 'Event excerpt',
      organizer: fullAdmin._id,
      startDate: new Date('2030-01-01T09:00:00.000Z'),
      endDate: new Date('2030-01-01T11:00:00.000Z'),
      location: 'CICT Hall',
      status: EventStatus.DRAFT,
      attendees: [],
      tags: [],
      isRegistrationOpen: false,
    });

    const eventUpdateResponse = await request(app)
      .put(`/api/events/${event._id}`)
      .set(authHeader(eventEditor.token))
      .send({
        location: 'Updated Hall',
        status: EventStatus.PUBLISHED,
        completedAt: new Date().toISOString(),
      });

    expect(eventUpdateResponse.status).toBe(400);
    expect(eventUpdateResponse.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'status' }),
        expect.objectContaining({ field: 'completedAt' }),
      ])
    );

    const unauthorizedPublishResponse = await request(app)
      .patch(`/api/events/${event._id}/publish`)
      .set(authHeader(eventEditor.token));

    expect(unauthorizedPublishResponse.status).toBe(403);

    const publishResponse = await request(app)
      .patch(`/api/events/${event._id}/publish`)
      .set(authHeader(eventPublisher.token));

    expect(publishResponse.status).toBe(200);

    const publishedEvent = await Event.findById(event._id);
    expect(publishedEvent?.status).toBe(EventStatus.PUBLISHED);
    expect(publishedEvent?.publishedAt).toBeTruthy();
  });

  it('records activity logs for workflow transitions', async () => {
    const { user: fullAdmin } = await createSystemUser({ role: UserRole.FULL_ADMIN });
    const publisher = await createPermissionedUser(
      [Permission.VIEW_NEWS, Permission.PUBLISH_NEWS],
      fullAdmin
    );

    const news = await News.create({
      title: 'Publishable news',
      content: 'News content',
      excerpt: 'Short excerpt',
      author: fullAdmin._id,
      status: NewsStatus.DRAFT,
      tags: [],
    });

    const response = await request(app)
      .patch(`/api/news/${news._id}/publish`)
      .set(authHeader(publisher.token));

    expect(response.status).toBe(200);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const log = await ActivityLog.findOne({
        action: 'publish',
        resource: 'news',
        resourceId: String(news._id),
      });

      if (log) {
        expect(log.user).toBe(String(publisher.user._id));
        return;
      }

      await wait(25);
    }

    throw new Error('Expected publish activity log to be created');
  });

  it('returns only published, active, non-expired announcements from the public endpoint', async () => {
    const { user: fullAdmin } = await createSystemUser({ role: UserRole.FULL_ADMIN });

    await Announcement.create([
      {
        title: 'Visible announcement',
        content: 'Visible content',
        author: fullAdmin._id,
        priority: AnnouncementPriority.HIGH,
        type: AnnouncementType.GENERAL,
        status: NewsStatus.PUBLISHED,
        isActive: true,
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
        targetAudience: ['all'],
      },
      {
        title: 'Draft announcement',
        content: 'Draft content',
        author: fullAdmin._id,
        priority: AnnouncementPriority.MEDIUM,
        type: AnnouncementType.GENERAL,
        status: NewsStatus.DRAFT,
        isActive: true,
        targetAudience: ['all'],
      },
      {
        title: 'Inactive announcement',
        content: 'Inactive content',
        author: fullAdmin._id,
        priority: AnnouncementPriority.MEDIUM,
        type: AnnouncementType.GENERAL,
        status: NewsStatus.PUBLISHED,
        isActive: false,
        targetAudience: ['all'],
      },
      {
        title: 'Expired announcement',
        content: 'Expired content',
        author: fullAdmin._id,
        priority: AnnouncementPriority.MEDIUM,
        type: AnnouncementType.GENERAL,
        status: NewsStatus.PUBLISHED,
        isActive: true,
        expiresAt: new Date('2020-01-01T00:00:00.000Z'),
        targetAudience: ['all'],
      },
    ]);

    const response = await request(app).get('/api/public/announcements');

    expect(response.status).toBe(200);
    expect(response.body.data.announcements).toHaveLength(1);
    expect(response.body.data.announcements[0].title).toBe('Visible announcement');
  });

  it('supports organization filtering on the public announcements endpoint', async () => {
    const { user: fullAdmin } = await createSystemUser({ role: UserRole.FULL_ADMIN });

    await Announcement.create([
      {
        title: 'System announcement',
        content: 'System content',
        author: fullAdmin._id,
        priority: AnnouncementPriority.HIGH,
        type: AnnouncementType.GENERAL,
        status: NewsStatus.PUBLISHED,
        isActive: true,
        targetAudience: ['all'],
        ownerType: 'system',
      },
      {
        title: 'CSS announcement',
        content: 'CSS content',
        author: fullAdmin._id,
        priority: AnnouncementPriority.HIGH,
        type: AnnouncementType.GENERAL,
        status: NewsStatus.PUBLISHED,
        isActive: true,
        targetAudience: ['all'],
        ownerType: 'organization',
        organizationId: 'css',
      },
      {
        title: 'ISS announcement',
        content: 'ISS content',
        author: fullAdmin._id,
        priority: AnnouncementPriority.HIGH,
        type: AnnouncementType.GENERAL,
        status: NewsStatus.PUBLISHED,
        isActive: true,
        targetAudience: ['all'],
        ownerType: 'organization',
        organizationId: 'iss',
      },
    ]);

    const response = await request(app).get(
      '/api/public/announcements?ownerType=organization&organizationId=css'
    );

    expect(response.status).toBe(200);
    expect(response.body.data.announcements).toHaveLength(1);
    expect(response.body.data.announcements[0].title).toBe('CSS announcement');
  });

  it('returns default FAQ content publicly and allows privileged admins to update it', async () => {
    const publicResponse = await request(app).get('/api/faqs');

    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.data.title).toBe('Frequently Asked Questions');
    expect(publicResponse.body.data.questions.length).toBeGreaterThan(0);

    const { token } = await createSystemUser({ role: UserRole.FULL_ADMIN });

    const updateResponse = await request(app)
      .put('/api/faqs')
      .set(authHeader(token))
      .send({
        title: 'Updated FAQ',
        subtitle: 'Fresh answers for students',
        topics: [{ id: 'general', label: 'General' }],
        questions: [
          {
            category: 'general',
            question: 'When is the next enrollment window?',
            answer: 'Please check the official announcements feed for exact enrollment dates.',
          },
        ],
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.title).toBe('Updated FAQ');

    const persisted = await FAQContent.findOne({ key: 'landing' });
    expect(persisted?.title).toBe('Updated FAQ');
    expect(persisted?.questions).toHaveLength(1);
  });

  it('blocks deleting a custom role that is still assigned to users', async () => {
    const { user: fullAdmin } = await createSystemUser({ role: UserRole.FULL_ADMIN });
    const roleManager = await createPermissionedUser([Permission.DELETE_ROLE], fullAdmin);
    const assignedRole = await Role.create({
      name: 'Assigned role',
      description: 'In use by a user',
      permissions: [Permission.VIEW_NEWS],
      createdBy: fullAdmin._id,
    });

    await User.create({
      email: 'assigned-role-user@example.com',
      password: TEST_PASSWORD,
      firstName: 'Assigned',
      lastName: 'User',
      role: UserRole.SUPPORT,
      customRole: assignedRole._id,
      isActive: true,
    });

    const response = await request(app)
      .delete(`/api/roles/${assignedRole._id}`)
      .set(authHeader(roleManager.token));

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      'Cannot delete a custom role that is still assigned to users or organization scopes. Reassign or remove it first.'
    );
  });

  it('honors custom-role override even when the stored base role is full_admin', async () => {
    const { user: fullAdmin } = await createSystemUser({ role: UserRole.FULL_ADMIN });
    const restrictiveRole = await Role.create({
      name: 'Restricted override',
      description: 'Can only view events',
      permissions: [Permission.VIEW_EVENT],
      isSystemRole: false,
      createdBy: fullAdmin._id,
    });

    fullAdmin.customRole = restrictiveRole._id;
    await fullAdmin.save();

    const response = await request(app)
      .get('/api/roles')
      .set(authHeader(signToken(fullAdmin)));

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('You do not have permission to perform this action');
  });

  it('lets scoped admins into protected admin flows while keeping content visibility org-only', async () => {
    const { user: fullAdmin } = await createSystemUser({ role: UserRole.FULL_ADMIN });

    await Organization.create([
      {
        id: 'css',
        name: 'CSS',
        fullName: 'Computer Studies Society',
        description: 'CSS org',
        longDescription: 'Computer Studies Society organization',
        logo: '/css-logo.png',
        banner: '/css-banner.png',
        established: '2010',
        mission: 'Serve CSS students',
        vision: 'Grow CSS leaders',
        values: ['Service'],
        achievements: ['Hackathon'],
        members: [],
        color: { primary: '#111111', secondary: '#222222', accent: '#333333' },
      },
      {
        id: 'iss',
        name: 'ISS',
        fullName: 'Information Systems Society',
        description: 'ISS org',
        longDescription: 'Information Systems Society organization',
        logo: '/iss-logo.png',
        banner: '/iss-banner.png',
        established: '2011',
        mission: 'Serve ISS students',
        vision: 'Grow ISS leaders',
        values: ['Innovation'],
        achievements: ['Forum'],
        members: [],
        color: { primary: '#444444', secondary: '#555555', accent: '#666666' },
      },
    ]);

    const scopedAdmin = await createScopedUser(
      [Permission.VIEW_NEWS, Permission.VIEW_ANNOUNCEMENT, Permission.EDIT_ORGANIZATION],
      'css',
      fullAdmin
    );

    await News.create([
      {
        title: 'CSS draft',
        bodyHtml: '<p>css</p>',
        excerpt: 'css',
        author: fullAdmin._id,
        ownerType: 'organization',
        organizationId: 'css',
        status: NewsStatus.DRAFT,
        tags: [],
        gallery: [],
        sections: [],
      },
      {
        title: 'ISS draft',
        bodyHtml: '<p>iss</p>',
        excerpt: 'iss',
        author: fullAdmin._id,
        ownerType: 'organization',
        organizationId: 'iss',
        status: NewsStatus.DRAFT,
        tags: [],
        gallery: [],
        sections: [],
      },
    ]);

    await Announcement.create([
      {
        title: 'CSS admin announcement',
        bodyHtml: '<p>css</p>',
        author: fullAdmin._id,
        ownerType: 'organization',
        organizationId: 'css',
        priority: AnnouncementPriority.MEDIUM,
        type: AnnouncementType.GENERAL,
        status: NewsStatus.DRAFT,
        isActive: false,
        targetAudience: ['all'],
        gallery: [],
        sections: [],
      },
      {
        title: 'ISS admin announcement',
        bodyHtml: '<p>iss</p>',
        author: fullAdmin._id,
        ownerType: 'organization',
        organizationId: 'iss',
        priority: AnnouncementPriority.MEDIUM,
        type: AnnouncementType.GENERAL,
        status: NewsStatus.DRAFT,
        isActive: false,
        targetAudience: ['all'],
        gallery: [],
        sections: [],
      },
    ]);

    const newsResponse = await request(app)
      .get('/api/news')
      .set(authHeader(scopedAdmin.token));

    expect(newsResponse.status).toBe(200);
    expect(newsResponse.body.data.news.map((item: { title: string }) => item.title)).toEqual([
      'CSS draft',
    ]);

    const announcementsResponse = await request(app)
      .get('/api/announcements')
      .set(authHeader(scopedAdmin.token));

    expect(announcementsResponse.status).toBe(200);
    expect(
      announcementsResponse.body.data.announcements.map(
        (item: { title: string }) => item.title
      )
    ).toEqual(['CSS admin announcement']);
  });

  it('keeps public organization payloads free of adminAssignments while exposing scoped admin data on protected admin endpoints', async () => {
    const { user: fullAdmin } = await createSystemUser({ role: UserRole.FULL_ADMIN });

    await Organization.create([
      {
        id: 'css',
        name: 'CSS',
        fullName: 'Computer Studies Society',
        description: 'CSS org',
        longDescription: 'Computer Studies Society organization',
        logo: '/css-logo.png',
        banner: '/css-banner.png',
        established: '2010',
        mission: 'Serve CSS students',
        vision: 'Grow CSS leaders',
        values: ['Service'],
        achievements: ['Hackathon'],
        members: [],
        color: { primary: '#111111', secondary: '#222222', accent: '#333333' },
      },
      {
        id: 'iss',
        name: 'ISS',
        fullName: 'Information Systems Society',
        description: 'ISS org',
        longDescription: 'Information Systems Society organization',
        logo: '/iss-logo.png',
        banner: '/iss-banner.png',
        established: '2011',
        mission: 'Serve ISS students',
        vision: 'Grow ISS leaders',
        values: ['Innovation'],
        achievements: ['Forum'],
        members: [],
        color: { primary: '#444444', secondary: '#555555', accent: '#666666' },
      },
    ]);

    const scopedAdmin = await createScopedUser(
      [Permission.VIEW_ORGANIZATION, Permission.EDIT_ORGANIZATION],
      'css',
      fullAdmin
    );

    const publicResponse = await request(app).get('/api/organizations/css');

    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.data.adminAssignments).toBeUndefined();

    const adminResponse = await request(app)
      .get('/api/organizations/admin/css')
      .set(authHeader(scopedAdmin.token));

    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.data.adminAssignments).toHaveLength(1);

    const assignmentsResponse = await request(app)
      .get('/api/organizations/admin/css/assignments')
      .set(authHeader(scopedAdmin.token));

    expect(assignmentsResponse.status).toBe(200);
    expect(assignmentsResponse.body.data.assignments).toHaveLength(1);

    const forbiddenResponse = await request(app)
      .get('/api/organizations/admin/iss')
      .set(authHeader(scopedAdmin.token));

    expect(forbiddenResponse.status).toBe(403);
    expect(forbiddenResponse.body.message).toBe(
      'You do not have access to this organization scope'
    );
  });

  it('derives admin module visibility from backend auth state and keeps content-only scoped users out of organization admin endpoints', async () => {
    const { user: fullAdmin } = await createSystemUser({ role: UserRole.FULL_ADMIN });

    await Organization.create({
      id: 'css',
      name: 'CSS',
      fullName: 'Computer Studies Society',
      description: 'CSS org',
      longDescription: 'Computer Studies Society organization',
      logo: '/css-logo.png',
      banner: '/css-banner.png',
      established: '2010',
      mission: 'Serve CSS students',
      vision: 'Grow CSS leaders',
      values: ['Service'],
      achievements: ['Hackathon'],
      members: [],
      color: { primary: '#111111', secondary: '#222222', accent: '#333333' },
    });

    const contentScopedUser = await createScopedUser(
      [Permission.VIEW_NEWS, Permission.CREATE_NEWS],
      'css',
      fullAdmin
    );

    const profileResponse = await request(app)
      .get('/api/auth/profile')
      .set(authHeader(contentScopedUser.token));

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.data.canAccessAdmin).toBe(true);
    expect(profileResponse.body.data.user.visibleAdminModules).toEqual(
      expect.arrayContaining(['dashboard', 'news'])
    );
    expect(profileResponse.body.data.user.visibleAdminModules).not.toContain('organizations');
    expect(profileResponse.body.data.user.scopedAdminModulesByOrganization.css).toEqual(['news']);

    const assignmentsResponse = await request(app)
      .get('/api/organizations/admin/css/assignments')
      .set(authHeader(contentScopedUser.token));

    expect(assignmentsResponse.status).toBe(403);
    expect(assignmentsResponse.body.message).toBe(
      'You do not have access to this organization scope'
    );
  });

  it('exposes backend permission metadata for frontend permission rendering to authenticated admins', async () => {
    const { user: fullAdmin, token } = await createSystemUser({ role: UserRole.FULL_ADMIN });

    expect(fullAdmin.role).toBe(UserRole.FULL_ADMIN);

    const unauthenticatedResponse = await request(app).get('/api/auth/permission-metadata');
    expect(unauthenticatedResponse.status).toBe(401);

    const response = await request(app)
      .get('/api/auth/permission-metadata')
      .set(authHeader(token));

    expect(response.status).toBe(200);
    expect(response.body.data.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: Permission.VIEW_NEWS,
          label: 'View News',
          group: 'News',
        }),
        expect.objectContaining({
          value: Permission.MANAGE_SETTINGS,
          label: 'Manage Settings',
          group: 'System',
        }),
      ])
    );
  });

  it('enforces role-management and assignment permission ceilings and uses SHA-256 media fingerprints', async () => {
    const { user: fullAdmin } = await createSystemUser({ role: UserRole.FULL_ADMIN });
    const limitedRoleManager = await createPermissionedUser(
      [Permission.CREATE_ROLE, Permission.CREATE_USER, Permission.ASSIGN_ROLE, Permission.VIEW_NEWS],
      fullAdmin
    );

    const elevatedCustomRole = await Role.create({
      name: 'Elevated publisher',
      description: 'Too much power for the limited actor',
      permissions: [Permission.PUBLISH_NEWS],
      isSystemRole: false,
      createdBy: fullAdmin._id,
    });

    const createRoleResponse = await request(app)
      .post('/api/roles')
      .set(authHeader(limitedRoleManager.token))
      .send({
        name: 'Escalated role',
        description: 'Attempts to mint delete_user',
        permissions: [Permission.DELETE_USER],
      });

    expect(createRoleResponse.status).toBe(403);
    expect(createRoleResponse.body.message).toContain('beyond your own global scope');

    const createUserResponse = await request(app)
      .post('/api/users')
      .set(authHeader(limitedRoleManager.token))
      .send({
        email: 'escalated-user@example.com',
        password: TEST_PASSWORD,
        firstName: 'Escalated',
        lastName: 'User',
        customRoleId: String(elevatedCustomRole._id),
      });

    expect(createUserResponse.status).toBe(403);
    expect(createUserResponse.body.message).toContain('beyond your own global scope');

    const sameFingerprintA = createMediaAssetFingerprint(Buffer.from('same bytes'));
    const sameFingerprintB = createMediaAssetFingerprint(Buffer.from('same bytes'));
    const differentFingerprint = createMediaAssetFingerprint(Buffer.from('different bytes'));

    expect(sameFingerprintA).toBe(sameFingerprintB);
    expect(differentFingerprint).not.toBe(sameFingerprintA);
    expect(sameFingerprintA).toMatch(/^[a-f0-9]{64}$/);
  });
});
