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

  // Student Management
  VIEW_STUDENT = 'view_student',
  CREATE_STUDENT = 'create_student',
  EDIT_STUDENT = 'edit_student',
  SET_STUDENT_STATUS = 'set_student_status',

  // Academic Grouping
  VIEW_ACADEMIC_GROUPS = 'view_academic_groups',
  MANAGE_ACADEMIC_GROUPS = 'manage_academic_groups',

  // Event Registration and Attendance
  VIEW_EVENT_REGISTRATIONS = 'view_event_registrations',
  MANAGE_EVENT_REGISTRATIONS = 'manage_event_registrations',
  SCAN_EVENT_ATTENDANCE = 'scan_event_attendance',

  // Approval Workflow
  SUBMIT_CONTENT_FOR_APPROVAL = 'submit_content_for_approval',
  APPROVE_CONTENT = 'approve_content',
  REJECT_CONTENT = 'reject_content',

  // Process Module
  VIEW_PROCESS = 'view_process',
  CREATE_PROCESS = 'create_process',
  EDIT_PROCESS = 'edit_process',
  COMMENT_PROCESS = 'comment_process',
  APPROVE_PROCESS_STEP = 'approve_process_step',
  
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
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
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
  approvalSummary?: IApprovalSummary;
  processInstanceId?: string | null;
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
  approvalSummary?: IApprovalSummary;
  processInstanceId?: string | null;
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
  user?: string | IUser;
  actorType?: 'admin' | 'student' | 'system';
  actorId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  organizationId?: string;
  eventId?: string;
  studentId?: string;
  outcome?: 'success' | 'failure' | 'denied' | 'duplicate';
  severity?: 'info' | 'warn' | 'critical';
  reasonCode?: string;
  correlationId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// Event Status
export enum EventStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export interface IApprovalSummary {
  submittedAt?: Date;
  submittedBy?: string;
  approvedAt?: Date;
  approvedBy?: string;
  rejectedAt?: Date;
  rejectedBy?: string;
  rejectionReason?: string;
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
  registeredCount?: number;
  checkedInCount?: number;
  registrationCloseAt?: Date;
  allowWalkIns?: boolean;
  targetProgramIds?: Array<string>;
  targetYearLevelIds?: Array<string>;
  targetSectionIds?: Array<string>;
  approvalSummary?: IApprovalSummary;
  processInstanceId?: string | null;
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
  | 'students'
  | 'events'
  | 'news'
  | 'announcements'
  | 'roles'
  | 'faq'
  | 'logs'
  | 'processes';

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

export enum StudentStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export interface IProgram extends Document {
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IYearLevel extends Document {
  code: string;
  label: string;
  numericLevel: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISection extends Document {
  programId: Types.ObjectId | IProgram;
  yearLevelId: Types.ObjectId | IYearLevel;
  name: string;
  displayName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudent extends Document {
  studentNumber: string;
  email?: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  programId: Types.ObjectId | IProgram;
  yearLevelId: Types.ObjectId | IYearLevel;
  sectionId: Types.ObjectId | ISection;
  status: StudentStatus;
  isActive: boolean;
  lastLoginAt?: Date;
  qrVersion: number;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IStudentSession extends Document {
  studentId: Types.ObjectId | IStudent;
  tokenHash: string;
  deviceLabel?: string;
  platform?: string;
  lastUsedAt?: Date;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum EventRegistrationStatus {
  RESERVED = 'reserved',
  REGISTERED = 'registered',
  CANCELLED = 'cancelled',
  CHECKED_IN = 'checked_in',
  DENIED = 'denied',
}

export interface IEventRegistration extends Document {
  eventId: Types.ObjectId | IEvent;
  studentId: Types.ObjectId | IStudent;
  status: EventRegistrationStatus;
  qrNonce: string;
  qrIssuedAt?: Date;
  registeredAt?: Date;
  cancelledAt?: Date;
  checkedInAt?: Date;
  eligibilitySnapshot?: {
    programId?: string;
    yearLevelId?: string;
    sectionId?: string;
  };
  scanCount: number;
  source: 'self' | 'admin' | 'walk_in';
  createdAt: Date;
  updatedAt: Date;
}

export enum AttendanceScanResult {
  SUCCESS = 'success',
  DUPLICATE = 'duplicate',
  NOT_REGISTERED = 'not_registered',
  EVENT_FULL = 'event_full',
  NOT_ELIGIBLE = 'not_eligible',
  REGISTRATION_CLOSED = 'registration_closed',
  INVALID_QR = 'invalid_qr',
  DENIED = 'denied',
}

export interface IEventAttendanceLog extends Document {
  eventId: Types.ObjectId | IEvent;
  registrationId?: Types.ObjectId | IEventRegistration;
  studentId?: Types.ObjectId | IStudent;
  scanType: 'entry' | 'manual';
  result: AttendanceScanResult;
  scannedByAdminId?: Types.ObjectId | IUser;
  scannedAt: Date;
  scannerDevice?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IContentApprovalAction extends Document {
  contentType: 'news' | 'announcement' | 'event';
  contentId: string;
  action:
    | 'submitted'
    | 'approved'
    | 'rejected'
    | 'published'
    | 'archived'
    | 'returned_to_draft';
  actorUserId: Types.ObjectId | IUser;
  reason?: string;
  comment?: string;
  fromStatus?: string;
  toStatus?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProcessNode {
  id: string;
  type: 'start' | 'task' | 'approval' | 'document_requirement' | 'comment_review' | 'end';
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface IProcessEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  data?: Record<string, unknown>;
}

export interface IProcessTemplate extends Document {
  title: string;
  description?: string;
  processType: string;
  organizationScope?: string | null;
  createdBy: Types.ObjectId | IUser;
  nodes: IProcessNode[];
  edges: IProcessEdge[];
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProcessInstance extends Document {
  templateId?: Types.ObjectId | IProcessTemplate;
  title: string;
  description?: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  linkedContentType?: 'news' | 'announcement' | 'event';
  linkedContentId?: string;
  organizationId?: string | null;
  createdBy: Types.ObjectId | IUser;
  assignedTo: string[];
  nodesSnapshot: IProcessNode[];
  edgesSnapshot: IProcessEdge[];
  currentNodeIds: string[];
  comments: Array<{
    authorId: string;
    body: string;
    createdAt: Date;
  }>;
  requirements: Array<{
    id: string;
    label: string;
    completed: boolean;
    completedBy?: string;
    completedAt?: Date;
  }>;
  approvalSteps: Array<{
    nodeId: string;
    status: 'pending' | 'approved' | 'rejected';
    actorId?: string;
    actedAt?: Date;
    reason?: string;
  }>;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudentJWTPayload {
  studentId: string;
  studentNumber: string;
  email?: string;
  actorType: 'student';
  sessionId?: string;
}

export interface IAuthenticatedStudent {
  studentId: string;
  studentNumber: string;
  email?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  status: StudentStatus;
  isActive: boolean;
  qrVersion: number;
  programId: string;
  yearLevelId: string;
  sectionId: string;
}
