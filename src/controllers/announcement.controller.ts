import { Request, Response } from 'express';
import Announcement from '../models/Announcement';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import {
  AnnouncementPriority,
  AnnouncementType,
  ContentOwnerType,
  NewsStatus,
  Permission,
} from '../types';
import logger from '../utils/logger';
import { deleteFromCloudinary } from '../middleware/upload';
import {
  buildLegacyPlainText,
  normalizeGalleryExcludingCover,
  normalizeMediaAsset,
  normalizeSections,
} from '../utils/content';
import {
  canReassignOwnership,
  ensureCanManageOwnedContent,
  getAccessibleOrganizationIdsForAuthenticatedUser,
  resolveOwnershipInput,
  validateOwnershipPair,
} from '../utils/organizationScope';
import { attachOrganizationName, attachOrganizationNames } from '../utils/ownedContent';
import { hasGlobalPermission } from '../utils/rbac';
import {
  buildApprovedApprovalSummary,
  buildRejectedApprovalSummary,
  buildSubmittedApprovalSummary,
  canPublishFromWorkflowStatus,
  ensureFullAdminApprover,
  recordContentApprovalAction,
  shouldResetApprovalOnEdit,
} from '../utils/contentApproval';

const ANNOUNCEMENT_EDITABLE_FIELDS = [
  'title',
  'bodyHtml',
  'priority',
  'type',
  'expiresAt',
  'targetAudience',
  'coverImage',
  'gallery',
  'sections',
  'imageUrl',
  'imageId',
] as const;

const buildAnnouncementUpdatePayload = (body: Record<string, unknown>) => {
  const updates: Partial<Record<(typeof ANNOUNCEMENT_EDITABLE_FIELDS)[number], unknown>> = {};

  for (const field of ANNOUNCEMENT_EDITABLE_FIELDS) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  return updates;
};

const canViewDraftAnnouncements = (req: AuthRequest): boolean =>
  !!req.user && hasGlobalPermission(req.user, Permission.VIEW_ANNOUNCEMENT);

const getPublicAnnouncementQuery = () => ({
  status: NewsStatus.PUBLISHED,
  isActive: true,
  $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: new Date() } }],
});

const buildOwnershipFilter = (
  ownerType?: ContentOwnerType,
  organizationId?: string | null
): Record<string, unknown> => {
  const filter: Record<string, unknown> = {};

  if (ownerType) {
    filter.ownerType = ownerType;
  }

  if (organizationId) {
    filter.organizationId = organizationId;
  }

  return filter;
};

/**
 * Create new announcement
 */
export const createAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }

    const {
      title,
      content,
      bodyHtml: rawBodyHtml,
      priority = AnnouncementPriority.MEDIUM,
      type = AnnouncementType.GENERAL,
      expiresAt,
      targetAudience,
      imageUrl,
      imageId,
      coverImage,
      gallery,
      sections,
    } = req.body;
    const ownership = resolveOwnershipInput(req.body);
    await validateOwnershipPair(ownership.ownerType, ownership.organizationId);
    await ensureCanManageOwnedContent(
      req.user,
      Permission.CREATE_ANNOUNCEMENT,
      ownership.ownerType,
      ownership.organizationId
    );

    const bodyHtml =
      typeof rawBodyHtml === 'string' && rawBodyHtml.trim().length > 0
        ? rawBodyHtml
        : typeof content === 'string'
          ? content
          : '';
    const resolvedCoverImage = normalizeMediaAsset(coverImage, { imageUrl, imageId });

    const announcement = await Announcement.create({
      title,
      content: buildLegacyPlainText(bodyHtml),
      bodyHtml,
      author: req.user.userId,
      ownerType: ownership.ownerType,
      organizationId: ownership.organizationId,
      priority,
      type,
      status: NewsStatus.DRAFT,
      isActive: false,
      expiresAt,
      targetAudience: targetAudience || ['all'],
      sections: normalizeSections(sections),
      coverImage: resolvedCoverImage,
      gallery: normalizeGalleryExcludingCover(gallery, resolvedCoverImage),
      imageUrl,
      imageId,
    });

    logger.info(`Announcement created: ${announcement._id} by user ${req.user.userId}`);

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: { announcement },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Get all announcements
 */
export const getAllAnnouncements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, priority, page = 1, limit = 10, search, ownerType, organizationId } = req.query;

    const conditions: Record<string, unknown>[] = [];
    const requestedOwnerType =
      ownerType === ContentOwnerType.ORGANIZATION
        ? ContentOwnerType.ORGANIZATION
        : ownerType === ContentOwnerType.SYSTEM
          ? ContentOwnerType.SYSTEM
          : undefined;
    const requestedOrganizationId =
      typeof organizationId === 'string' && organizationId.trim().length > 0
        ? organizationId.trim().toLowerCase()
        : null;

    if (!req.user) {
      conditions.push({
        ...getPublicAnnouncementQuery(),
        ...buildOwnershipFilter(requestedOwnerType, requestedOrganizationId),
      });
    } else if (hasGlobalPermission(req.user, Permission.VIEW_ANNOUNCEMENT)) {
      const adminCondition: Record<string, unknown> = {
        ...buildOwnershipFilter(requestedOwnerType, requestedOrganizationId),
      };
      if (status) {
        adminCondition.status = status;
      }
      conditions.push(adminCondition);
    } else if (req.user) {
      const accessibleOrganizationIds = getAccessibleOrganizationIdsForAuthenticatedUser(
        req.user,
        Permission.VIEW_ANNOUNCEMENT
      );

      if (accessibleOrganizationIds.length > 0 && requestedOwnerType !== ContentOwnerType.SYSTEM) {
        const allowedOrganizationIds = requestedOrganizationId
          ? accessibleOrganizationIds.filter((id) => id === requestedOrganizationId)
          : accessibleOrganizationIds;

        if (allowedOrganizationIds.length > 0) {
          const scopedCondition: Record<string, unknown> = {
            ownerType: ContentOwnerType.ORGANIZATION,
            organizationId: { $in: allowedOrganizationIds },
          };

          if (status) {
            scopedCondition.status = status;
          }

          conditions.push(scopedCondition);
        } else {
          conditions.push({ _id: null });
        }
      } else {
        conditions.push({ _id: null });
      }
    }

    if (priority) {
      conditions.push({ priority });
    }

    if (search) {
      conditions.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { content: { $regex: search, $options: 'i' } },
          { bodyHtml: { $regex: search, $options: 'i' } },
        ],
      });
    }
    const query = conditions.length <= 1 ? conditions[0] ?? {} : { $and: conditions };

    const skip = (Number(page) - 1) * Number(limit);

    const [announcements, total] = await Promise.all([
      Announcement.find(query)
        .populate('author', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Announcement.countDocuments(query),
    ]);
    const serializedAnnouncements = await attachOrganizationNames(announcements);

    res.status(200).json({
      success: true,
      data: {
        announcements: serializedAnnouncements,
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
 * Public announcements
 */
export const getPublicAnnouncements = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, type, ownerType, organizationId } = req.query;
    const conditions: Record<string, unknown>[] = [getPublicAnnouncementQuery()];
    const requestedOwnerType =
      ownerType === ContentOwnerType.ORGANIZATION
        ? ContentOwnerType.ORGANIZATION
        : ownerType === ContentOwnerType.SYSTEM
          ? ContentOwnerType.SYSTEM
          : undefined;
    const requestedOrganizationId =
      typeof organizationId === 'string' && organizationId.trim().length > 0
        ? organizationId.trim().toLowerCase()
        : null;
    const skip = (Number(page) - 1) * Number(limit);

    if (type) {
      conditions.push({ type });
    }

    if (requestedOwnerType || requestedOrganizationId) {
      conditions.push(buildOwnershipFilter(requestedOwnerType, requestedOrganizationId));
    }

    if (search) {
      conditions.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { content: { $regex: search, $options: 'i' } },
          { bodyHtml: { $regex: search, $options: 'i' } },
        ],
      });
    }

    const finalQuery = conditions.length === 1 ? conditions[0] : { $and: conditions };

    const [announcements, total] = await Promise.all([
      Announcement.find(finalQuery)
        .populate('author', 'firstName lastName email')
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Announcement.countDocuments(finalQuery),
    ]);
    const serializedAnnouncements = await attachOrganizationNames(announcements);

    res.status(200).json({
      success: true,
      data: {
        announcements: serializedAnnouncements,
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
 * Get single announcement by ID
 */
export const getAnnouncementById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findById(id).populate('author', 'firstName lastName email');

    if (!announcement) {
      throw new AppError('Announcement not found', 404);
    }

    if (!canViewDraftAnnouncements(req)) {
      const matchesPublicState =
        announcement.status === NewsStatus.PUBLISHED &&
        announcement.isActive &&
        (!announcement.expiresAt || announcement.expiresAt >= new Date());

      if (!matchesPublicState) {
        await ensureCanManageOwnedContent(
          req.user,
          Permission.VIEW_ANNOUNCEMENT,
          announcement.ownerType,
          announcement.organizationId ?? null
        );
      }
    }

    const serializedAnnouncement = await attachOrganizationName(announcement);

    res.status(200).json({
      success: true,
      data: { announcement: serializedAnnouncement },
    });
  } catch (error) {
    throw error;
  }
};

export const getPublicAnnouncementById = async (req: Request, res: Response): Promise<void> => {
  const authRequest = req as AuthRequest;
  authRequest.user = undefined;
  return getAnnouncementById(authRequest, res);
};

/**
 * Update announcement
 */
export const updateAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existingAnnouncement = await Announcement.findById(id);
    if (!existingAnnouncement) {
      throw new AppError('Announcement not found', 404);
    }

    await ensureCanManageOwnedContent(
      req.user,
      Permission.EDIT_ANNOUNCEMENT,
      existingAnnouncement.ownerType,
      existingAnnouncement.organizationId ?? null
    );

    const currentOwnership = {
      ownerType: existingAnnouncement.ownerType,
      organizationId: existingAnnouncement.organizationId ?? null,
    };
    const nextOwnership = resolveOwnershipInput({
      ownerType: req.body.ownerType ?? currentOwnership.ownerType,
      organizationId:
        req.body.organizationId !== undefined
          ? req.body.organizationId
          : currentOwnership.organizationId,
    });
    await validateOwnershipPair(nextOwnership.ownerType, nextOwnership.organizationId);

    const canMoveOwnership = await canReassignOwnership(
      req.user!,
      currentOwnership.ownerType,
      currentOwnership.organizationId,
      nextOwnership.ownerType,
      nextOwnership.organizationId,
      Permission.EDIT_ANNOUNCEMENT
    );

    if (!canMoveOwnership) {
      throw new AppError('You cannot reassign ownership for this announcement', 403);
    }

    const updates = buildAnnouncementUpdatePayload(req.body);
    const bodyHtml =
      typeof updates.bodyHtml === 'string'
        ? updates.bodyHtml
        : typeof req.body.content === 'string'
          ? req.body.content
          : undefined;
    const imageUrl = typeof req.body.imageUrl === 'string' ? req.body.imageUrl : undefined;
    const imageId = typeof req.body.imageId === 'string' ? req.body.imageId : undefined;

    if (bodyHtml !== undefined) {
      updates.bodyHtml = bodyHtml;
      (updates as Record<string, unknown>).content = buildLegacyPlainText(bodyHtml);
    }

    if (
      req.body.coverImage !== undefined ||
      req.body.imageUrl !== undefined ||
      req.body.imageId !== undefined
    ) {
      updates.coverImage = normalizeMediaAsset(req.body.coverImage, { imageUrl, imageId });
      updates.imageUrl = imageUrl;
      updates.imageId = imageId;
    }

    if (req.body.gallery !== undefined) {
      const effectiveCoverImage =
        (updates.coverImage as typeof existingAnnouncement.coverImage | undefined) ??
        existingAnnouncement.coverImage;
      updates.gallery = normalizeGalleryExcludingCover(req.body.gallery, effectiveCoverImage);
    }

    if (req.body.sections !== undefined) {
      updates.sections = normalizeSections(req.body.sections);
    }

    (updates as Record<string, unknown>).ownerType = nextOwnership.ownerType;
    (updates as Record<string, unknown>).organizationId = nextOwnership.organizationId;

    if (shouldResetApprovalOnEdit(existingAnnouncement.status)) {
      (updates as Record<string, unknown>).status = NewsStatus.DRAFT;
      (updates as Record<string, unknown>).approvalSummary = undefined;
    }

    const announcement = await Announcement.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('author', 'firstName lastName email');

    if (!announcement) {
      throw new AppError('Announcement not found', 404);
    }

    logger.info(`Announcement updated: ${id} by user ${req.user?.userId}`);

    res.status(200).json({
      success: true,
      message: 'Announcement updated successfully',
      data: { announcement },
    });
  } catch (error) {
    throw error;
  }
};

export const submitAnnouncementForApproval = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  const announcement = await Announcement.findById(id).populate('author', 'firstName lastName email');

  if (!announcement) {
    throw new AppError('Announcement not found', 404);
  }

  if (announcement.status !== NewsStatus.DRAFT) {
    throw new AppError('Only draft announcements can be submitted for approval', 400);
  }

  await ensureCanManageOwnedContent(
    req.user,
    Permission.SUBMIT_CONTENT_FOR_APPROVAL,
    announcement.ownerType,
    announcement.organizationId ?? null
  );

  const fromStatus = announcement.status;
  announcement.status = NewsStatus.PENDING_APPROVAL;
  announcement.approvalSummary = buildSubmittedApprovalSummary(
    req.user!.userId,
    announcement.approvalSummary
  );
  await announcement.save();
  await recordContentApprovalAction({
    contentType: 'announcement',
    contentId: String(announcement._id),
    actorUserId: req.user!.userId,
    action: 'submitted',
    fromStatus,
    toStatus: announcement.status,
    comment: typeof req.body.comment === 'string' ? req.body.comment.trim() : undefined,
  });

  res.status(200).json({
    success: true,
    message: 'Announcement submitted for approval',
    data: { announcement },
  });
};

export const approveAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const announcement = await Announcement.findById(id).populate('author', 'firstName lastName email');

  if (!announcement) {
    throw new AppError('Announcement not found', 404);
  }

  ensureFullAdminApprover(req.user);

  if (announcement.status !== NewsStatus.PENDING_APPROVAL) {
    throw new AppError('Only pending approval announcements can be approved', 400);
  }

  const fromStatus = announcement.status;
  announcement.status = NewsStatus.APPROVED;
  announcement.approvalSummary = buildApprovedApprovalSummary(
    req.user!.userId,
    announcement.approvalSummary
  );
  await announcement.save();
  await recordContentApprovalAction({
    contentType: 'announcement',
    contentId: String(announcement._id),
    actorUserId: req.user!.userId,
    action: 'approved',
    fromStatus,
    toStatus: announcement.status,
    comment: typeof req.body.comment === 'string' ? req.body.comment.trim() : undefined,
  });

  res.status(200).json({
    success: true,
    message: 'Announcement approved successfully',
    data: { announcement },
  });
};

export const rejectAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  const announcement = await Announcement.findById(id).populate('author', 'firstName lastName email');

  if (!announcement) {
    throw new AppError('Announcement not found', 404);
  }

  ensureFullAdminApprover(req.user);

  if (announcement.status !== NewsStatus.PENDING_APPROVAL) {
    throw new AppError('Only pending approval announcements can be rejected', 400);
  }

  if (!reason) {
    throw new AppError('Rejection reason is required', 400);
  }

  const fromStatus = announcement.status;
  announcement.status = NewsStatus.REJECTED;
  announcement.approvalSummary = buildRejectedApprovalSummary(
    req.user!.userId,
    reason,
    announcement.approvalSummary
  );
  await announcement.save();
  await recordContentApprovalAction({
    contentType: 'announcement',
    contentId: String(announcement._id),
    actorUserId: req.user!.userId,
    action: 'rejected',
    fromStatus,
    toStatus: announcement.status,
    reason,
    comment: typeof req.body.comment === 'string' ? req.body.comment.trim() : undefined,
  });

  res.status(200).json({
    success: true,
    message: 'Announcement rejected successfully',
    data: { announcement },
  });
};

/**
 * Delete announcement
 */
export const deleteAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingAnnouncement = await Announcement.findById(id);
    if (!existingAnnouncement) {
      throw new AppError('Announcement not found', 404);
    }

    await ensureCanManageOwnedContent(
      req.user,
      Permission.DELETE_ANNOUNCEMENT,
      existingAnnouncement.ownerType,
      existingAnnouncement.organizationId ?? null
    );

    const announcement = await Announcement.findByIdAndDelete(id);

    if (!announcement) {
      throw new AppError('Announcement not found', 404);
    }

    if (announcement.imageId) {
      await deleteFromCloudinary(announcement.imageId);
    }

    logger.info(`Announcement deleted: ${id} by user ${req.user?.userId}`);

    res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully',
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Publish announcement
 */
export const publishAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findById(id).populate('author', 'firstName lastName email');

    if (!announcement) {
      throw new AppError('Announcement not found', 404);
    }

    await ensureCanManageOwnedContent(
      req.user,
      Permission.PUBLISH_ANNOUNCEMENT,
      announcement.ownerType,
      announcement.organizationId ?? null
    );

    if (!canPublishFromWorkflowStatus(announcement.status)) {
      throw new AppError('Only draft or approved announcements can be published', 400);
    }

    const fromStatus = announcement.status;
    announcement.status = NewsStatus.PUBLISHED;
    announcement.publishedAt = new Date();
    announcement.archivedAt = undefined;
    announcement.isActive = true;
    await announcement.save();
    await recordContentApprovalAction({
      contentType: 'announcement',
      contentId: String(announcement._id),
      actorUserId: req.user!.userId,
      action: 'published',
      fromStatus,
      toStatus: announcement.status,
    });

    logger.info(`Announcement published: ${id} by user ${req.user?.userId}`);

    res.status(200).json({
      success: true,
      message: 'Announcement published successfully',
      data: { announcement },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Archive announcement
 */
export const archiveAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findById(id).populate('author', 'firstName lastName email');

    if (!announcement) {
      throw new AppError('Announcement not found', 404);
    }

    if (announcement.status !== NewsStatus.PUBLISHED) {
      throw new AppError('Only published announcements can be archived', 400);
    }

    await ensureCanManageOwnedContent(
      req.user,
      Permission.ARCHIVE_ANNOUNCEMENT,
      announcement.ownerType,
      announcement.organizationId ?? null
    );

    const fromStatus = announcement.status;
    announcement.status = NewsStatus.ARCHIVED;
    announcement.archivedAt = new Date();
    announcement.isActive = false;
    await announcement.save();
    await recordContentApprovalAction({
      contentType: 'announcement',
      contentId: String(announcement._id),
      actorUserId: req.user!.userId,
      action: 'archived',
      fromStatus,
      toStatus: announcement.status,
    });

    logger.info(`Announcement archived: ${id} by user ${req.user?.userId}`);

    res.status(200).json({
      success: true,
      message: 'Announcement archived successfully',
      data: { announcement },
    });
  } catch (error) {
    throw error;
  }
};
