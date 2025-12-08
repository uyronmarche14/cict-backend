import { Document, Types } from 'mongoose';

// User Roles
export enum UserRole {
  FULL_ADMIN = 'full_admin',
  SEMI_ADMIN = 'semi_admin',
  SUPPORT = 'support',
}

// Permission Types
export enum Permission {
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

// News Status
export enum NewsStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

// News Interface
export interface INews extends Document {
  title: string;
  content: string;
  excerpt: string;
  author: string | IUser;
  status: NewsStatus;
  publishedAt?: Date;
  archivedAt?: Date;
  tags: string[];
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
  content: string;
  author: string | IUser;
  priority: AnnouncementPriority;
  type: AnnouncementType;
  status: NewsStatus;
  isActive: boolean;
  publishedAt?: Date;
  archivedAt?: Date;
  expiresAt?: Date;
  targetAudience: string[];
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
  description: string;
  excerpt: string;
  organizer: string | IUser;
  startDate: Date;
  endDate: Date;
  location: string;
  status: EventStatus;
  attendees: Array<string | IUser>;
  maxAttendees?: number;
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

// Request with User
export interface IAuthRequest extends Request {
  user?: IJWTPayload;
}
