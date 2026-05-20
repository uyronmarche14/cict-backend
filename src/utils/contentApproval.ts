import ContentApprovalAction from '../models/ContentApprovalAction';
import { AppError } from '../middleware/errorHandler';
import { EventStatus, IApprovalSummary, IAuthenticatedUser, NewsStatus, Permission, UserRole } from '../types';
import { hasGlobalPermission } from './rbac';

export type ApprovalContentType = 'news' | 'announcement' | 'event';
type WorkflowStatus = NewsStatus | EventStatus;

const RESETTABLE_APPROVAL_STATUSES = new Set<string>([
  NewsStatus.PENDING_APPROVAL,
  NewsStatus.APPROVED,
  NewsStatus.REJECTED,
  EventStatus.PENDING_APPROVAL,
  EventStatus.APPROVED,
  EventStatus.REJECTED,
]);

export const shouldResetApprovalOnEdit = (status: string): boolean =>
  RESETTABLE_APPROVAL_STATUSES.has(status);

const PUBLISHABLE_WORKFLOW_STATUSES = new Set<string>([
  NewsStatus.DRAFT,
  NewsStatus.APPROVED,
  EventStatus.DRAFT,
  EventStatus.APPROVED,
]);

export const canPublishFromWorkflowStatus = (status: string): boolean =>
  PUBLISHABLE_WORKFLOW_STATUSES.has(status);

export const ensureFullAdminApprover = (user?: IAuthenticatedUser): void => {
  if (!user) {
    throw new AppError('User not authenticated', 401);
  }

  if (user.role !== UserRole.FULL_ADMIN || !hasGlobalPermission(user, Permission.APPROVE_CONTENT)) {
    throw new AppError('Only full admins can approve or reject content', 403);
  }
};

export const buildSubmittedApprovalSummary = (
  submittedBy: string,
  existing?: IApprovalSummary
): IApprovalSummary => ({
  submittedAt: new Date(),
  submittedBy,
  approvedAt: undefined,
  approvedBy: undefined,
  rejectedAt: undefined,
  rejectedBy: undefined,
  rejectionReason: undefined,
  ...(existing?.submittedAt ? { submittedAt: new Date() } : {}),
});

export const buildApprovedApprovalSummary = (
  approvedBy: string,
  existing?: IApprovalSummary
): IApprovalSummary => ({
  submittedAt: existing?.submittedAt,
  submittedBy: existing?.submittedBy,
  approvedAt: new Date(),
  approvedBy,
  rejectedAt: undefined,
  rejectedBy: undefined,
  rejectionReason: undefined,
});

export const buildRejectedApprovalSummary = (
  rejectedBy: string,
  reason: string,
  existing?: IApprovalSummary
): IApprovalSummary => ({
  submittedAt: existing?.submittedAt,
  submittedBy: existing?.submittedBy,
  approvedAt: undefined,
  approvedBy: undefined,
  rejectedAt: new Date(),
  rejectedBy,
  rejectionReason: reason,
});

export const recordContentApprovalAction = async (input: {
  contentType: ApprovalContentType;
  contentId: string;
  actorUserId: string;
  action: 'submitted' | 'approved' | 'rejected' | 'published' | 'archived' | 'returned_to_draft';
  fromStatus: WorkflowStatus;
  toStatus: WorkflowStatus;
  reason?: string;
  comment?: string;
}) => {
  await ContentApprovalAction.create({
    contentType: input.contentType,
    contentId: input.contentId,
    actorUserId: input.actorUserId,
    action: input.action,
    reason: input.reason,
    comment: input.comment,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
  });
};
