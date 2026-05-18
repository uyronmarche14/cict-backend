import { Document, Types } from 'mongoose';

// User Roles
export enum UserRole {
  FULL_ADMIN = 'full_admin',
  SEMI_ADMIN = 'semi_admin',
  SUPPORT = 'support',
}

// Permission Types
export enum Permission {
  // User Account Management
  VIEW_USERS = 'view_users',
  CREATE_USER = 'create_user',
  EDIT_USER = 'edit_user',
  DELETE_USER = 'delete_user',
  SET_USER_STATUS = 'set_user_status',

  // Organization Management
  VIEW_ORGANIZATION = 'view_organization',
  CREATE_ORGANIZATION = 'create_organization',
  EDIT_ORGANIZATION = 'edit_organization',
  DELETE_ORGANIZATION = 'delete_organization',

  // News Management
  CREATE_NEWS = 'create_news',
  EDIT_NEWS = 'edit_news',
  DELETE_NEWS = 'delete_news',
  PUBLISH_NEWS = 'publish_news',
  ARCHIVE_NEWS = 'archive_news',
  VIEW_NEWS = 'view_news',
  
  // Announcement Management
  CREATE_ANNOUNCEMENT = 'create_announcement',
  EDIT_ANNOUNCEMENT = 'edit_announcement',
  DELETE_ANNOUNCEMENT = 'delete_announcement',
  PUBLISH_ANNOUNCEMENT = 'publish_announcement',
  ARCHIVE_ANNOUNCEMENT = 'archive_announcement',
  VIEW_ANNOUNCEMENT = 'view_announcement',
  
  // Member Management
  CREATE_MEMBER = 'create_member',
  EDIT_MEMBER = 'edit_member',
  DELETE_MEMBER = 'delete_member',
  VIEW_MEMBER = 'view_member',
  MANAGE_MEMBER_ROLES = 'manage_member_roles',
  
  // Event Management
  CREATE_EVENT = 'create_event',
  EDIT_EVENT = 'edit_event',
  DELETE_EVENT = 'delete_event',
  PUBLISH_EVENT = 'publish_event',
  CANCEL_EVENT = 'cancel_event',
  COMPLETE_EVENT = 'complete_event',
  VIEW_EVENT = 'view_event',
  JOIN_EVENT = 'join_event',
  
  // Role Management
  CREATE_ROLE = 'create_role',
  EDIT_ROLE = 'edit_role',
  DELETE_ROLE = 'delete_role',
  VIEW_ROLE = 'view_role',
  ASSIGN_ROLE = 'assign_role',
  
  // System
  VIEW_LOGS = 'view_logs',
  MANAGE_SETTINGS = 'manage_settings',
}

// User Interface
export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  customRole?: Types.ObjectId;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// Role Interface
export interface IRole extends Document {
  name: string;
  description: string;
  permissions: Permission[];
  isSystemRole: boolean;
  createdBy: string | IUser;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMediaAsset {
  imageUrl: string;
  imageId?: string;
  assetFingerprint?: string;
  alt: string;
  caption?: string;
  sortOrder?: number;
}

export interface IContentSection {
  heading: string;
  style: 'default' | 'callout' | 'checklist';
  bodyHtml?: string;
  items?: string[];
}

export interface IEventScheduleItem {
  label: string;
  title: string;
  description?: string;
}

export enum ContentOwnerType {
  SYSTEM = 'system',
  ORGANIZATION = 'organization',
}

// News Status
export enum NewsStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

// News Interface
export interface INews extends Document {
  title: string;
  content?: string;
  bodyHtml: string;
  excerpt: string;
  author: string | IUser;
  ownerType: ContentOwnerType;
  organizationId?: string | null;
  status: NewsStatus;
  publishedAt?: Date;
  archivedAt?: Date;
  tags: string[];
  coverImage?: IMediaAsset;
  gallery: IMediaAsset[];
  sections: IContentSection[];
  imageUrl?: string;
  imageId?: string; // Cloudinary public ID
  createdAt: Date;
  updatedAt: Date;
}

// Announcement Priority
export enum AnnouncementPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

// Announcement Type
export enum AnnouncementType {
  GENERAL = 'general',
  ACADEMIC = 'academic',
  EVENT = 'event',
  EMERGENCY = 'emergency',
}

// Announcement Interface
export interface IAnnouncement extends Document {
  title: string;
  content?: string;
  bodyHtml: string;
  author: string | IUser;
  ownerType: ContentOwnerType;
  organizationId?: string | null;
  priority: AnnouncementPriority;
  type: AnnouncementType;
  status: NewsStatus;
  isActive: boolean;
  publishedAt?: Date;
  archivedAt?: Date;
  expiresAt?: Date;
  targetAudience: string[];
  coverImage?: IMediaAsset;
  gallery: IMediaAsset[];
  sections: IContentSection[];
  imageUrl?: string;
  imageId?: string; // Cloudinary public ID
  createdAt: Date;
  updatedAt: Date;
}

// Activity Log Interface
export interface IActivityLog extends Document {
  user: string | IUser;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// Event Status
export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

// Event Interface
export interface IEvent extends Document {
  title: string;
  description?: string;
  bodyHtml: string;
  excerpt: string;
  organizer: string | IUser;
  ownerType: ContentOwnerType;
  organizationId?: string | null;
  startDate: Date;
  endDate: Date;
  location: string;
  status: EventStatus;
  publishedAt?: Date;
  cancelledAt?: Date;
  completedAt?: Date;
  attendees: Array<string | IUser>;
  maxAttendees?: number;
  coverImage?: IMediaAsset;
  gallery: IMediaAsset[];
  sections: IContentSection[];
  schedule: IEventScheduleItem[];
  imageUrl?: string;
  imageId?: string; // Cloudinary public ID
  tags: string[];
  isRegistrationOpen: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// JWT Payload
export interface IJWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  customRole?: string;
}

export interface IOrganizationAssignment extends Document {
  user: string | IUser;
  organizationId: string;
  role: string | IRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFAQTopic {
  id: string;
  label: string;
}

export interface IFAQEntry {
  category: string;
  question: string;
  answer: string;
}

export interface IFAQContent extends Document {
  key: string;
  title: string;
  subtitle: string;
  topics: IFAQTopic[];
  questions: IFAQEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IResolvedOrganizationAssignment {
  id: string;
  organizationId: string;
  organizationName?: string;
  roleId: string;
  roleName: string;
  permissions: Permission[];
}

export interface IAdminScopes {
  global: boolean;
  organizations: string[];
}

export type AdminModule =
  | 'dashboard'
  | 'organizations'
  | 'users'
  | 'events'
  | 'news'
  | 'announcements'
  | 'roles'
  | 'faq';

export type IScopedAdminModulesByOrganization = Record<string, AdminModule[]>;

export interface IPermissionMetadata {
  value: Permission;
  label: string;
  description: string;
  group: string;
}

export interface IAuthenticatedUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  customRole?: string;
  customRoleDetails?: {
    id: string;
    name: string;
    description: string;
    permissions: Permission[];
  } | null;
  permissions: Permission[];
  baseRoleLabel?: string;
  effectiveRoleLabel: string;
  effectiveRoleKind?: 'system' | 'custom';
  canAccessAdmin: boolean;
  adminScopes?: IAdminScopes;
  visibleAdminModules?: AdminModule[];
  scopedAdminModulesByOrganization?: IScopedAdminModulesByOrganization;
  organizationAssignments?: IResolvedOrganizationAssignment[];
  isActive: boolean;
}

// Request with User
export interface IAuthRequest extends Request {
  user?: IJWTPayload;
}

// Organization Member Interface
export interface IOrganizationMember {
  id: string;
  name: string;
  position: string;
  photo: string;
  bio: string;
  joinedDate?: string;
  achievements?: string[];
  responsibilities?: string[];
  skills?: string[];
  timeline?: {
    year: string;
    title: string;
    description: string;
    category: 'achievement' | 'project' | 'milestone' | 'award' | 'education';
    details?: string[];
  }[];
  gallery?: string[];
  social?: {
    linkedin?: string;
    github?: string;
    email?: string;
  };
}

// Organization Interface
export interface IOrganization extends Document {
  id: string; // slug like 'ict-sf'
  name: string;
  fullName: string;
  description: string;
  longDescription: string;
  logo: string;
  banner: string;
  established: string;
  mission: string;
  vision: string;
  values: string[];
  achievements: string[];
  members: IOrganizationMember[];
  color: {
    primary: string;
    secondary: string;
    accent: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
