import { Response } from 'express';
import Event from '../models/Event';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { ContentOwnerType, EventStatus, Permission } from '../types';
import logger from '../utils/logger';
import { deleteFromCloudinary } from '../middleware/upload';
import {
  buildLegacyPlainText,
  normalizeGalleryExcludingCover,
  normalizeMediaAsset,
  normalizeSchedule,
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

const EVENT_EDITABLE_FIELDS = [
  'title',
  'bodyHtml',
  'excerpt',
  'startDate',
  'endDate',
  'location',
  'maxAttendees',
  'tags',
  'coverImage',
  'gallery',
  'sections',
  'schedule',
  'imageUrl',
  'imageId',
  'isRegistrationOpen',
] as const;

const buildEventUpdatePayload = (body: Record<string, unknown>) => {
  const updates: Partial<Record<(typeof EVENT_EDITABLE_FIELDS)[number], unknown>> = {};

  for (const field of EVENT_EDITABLE_FIELDS) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  return updates;
};

const parseEventDateInput = (value: unknown, fieldLabel: string): Date => {
  const parsedDate = new Date(String(value));

  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError(`${fieldLabel} must be a valid date`, 400);
  }

  return parsedDate;
};

const ensureValidEventDateRange = (startDateValue: unknown, endDateValue: unknown): void => {
  const startDate = parseEventDateInput(startDateValue, 'Start date');
  const endDate = parseEventDateInput(endDateValue, 'End date');

  if (startDate.getTime() > endDate.getTime()) {
    throw new AppError('Start date cannot be after end date', 400);
  }
};

const canViewDraftEvents = (req: AuthRequest): boolean =>
  !!req.user && hasGlobalPermission(req.user, Permission.VIEW_EVENT);

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
 * Create new event
 */
export const createEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }

    const {
      title,
      description,
      bodyHtml: rawBodyHtml,
      excerpt,
      startDate,
      endDate,
      location,
      maxAttendees,
      tags,
      imageUrl,
      imageId,
      isRegistrationOpen,
      coverImage,
      gallery,
      sections,
      schedule,
    } = req.body;
    const ownership = resolveOwnershipInput(req.body);
    await validateOwnershipPair(ownership.ownerType, ownership.organizationId);
    await ensureCanManageOwnedContent(
      req.user,
      Permission.CREATE_EVENT,
      ownership.ownerType,
      ownership.organizationId
    );

    const bodyHtml =
      typeof rawBodyHtml === 'string' && rawBodyHtml.trim().length > 0
        ? rawBodyHtml
        : typeof description === 'string'
          ? description
          : '';
    const resolvedCoverImage = normalizeMediaAsset(coverImage, { imageUrl, imageId });

    ensureValidEventDateRange(startDate, endDate);

    const event = await Event.create({
      title,
      description: buildLegacyPlainText(bodyHtml),
      bodyHtml,
      excerpt,
      organizer: req.user.userId,
      ownerType: ownership.ownerType,
      organizationId: ownership.organizationId,
      startDate,
      endDate,
      location,
      maxAttendees,
      tags: tags || [],
      sections: normalizeSections(sections),
      schedule: normalizeSchedule(schedule),
      coverImage: resolvedCoverImage,
      gallery: normalizeGalleryExcludingCover(gallery, resolvedCoverImage),
      imageUrl,
      imageId,
      status: EventStatus.DRAFT,
      isRegistrationOpen: isRegistrationOpen ?? false,
    });

    logger.info(`Event created: ${event._id} by user ${req.user.userId}`);

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: { event },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Get all events
 */
export const getAllEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, page = 1, limit = 10, search, upcoming, ownerType, organizationId } = req.query;

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
        status: EventStatus.PUBLISHED,
        ...buildOwnershipFilter(requestedOwnerType, requestedOrganizationId),
      });
    } else if (hasGlobalPermission(req.user, Permission.VIEW_EVENT)) {
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
        Permission.VIEW_EVENT
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

    if (search) {
      conditions.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { bodyHtml: { $regex: search, $options: 'i' } },
          { location: { $regex: search, $options: 'i' } },
        ],
      });
    }

    if (upcoming === 'true') {
      conditions.push({ endDate: { $gte: new Date() } });
    }
    const query = conditions.length <= 1 ? conditions[0] ?? {} : { $and: conditions };

    const skip = (Number(page) - 1) * Number(limit);

    const [events, total] = await Promise.all([
      Event.find(query)
        .populate('organizer', 'firstName lastName email')
        .sort({ startDate: 1 })
        .skip(skip)
        .limit(Number(limit)),
      Event.countDocuments(query),
    ]);
    const serializedEvents = await attachOrganizationNames(events);

    res.status(200).json({
      success: true,
      data: {
        events: serializedEvents,
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
 * Get single event by ID
 */
export const getEventById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id)
      .populate('organizer', 'firstName lastName email')
      .populate('attendees', 'firstName lastName email');

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (!canViewDraftEvents(req)) {
      if (event.status !== EventStatus.PUBLISHED) {
        await ensureCanManageOwnedContent(
          req.user,
          Permission.VIEW_EVENT,
          event.ownerType,
          event.organizationId ?? null
        );
      }
    }

    const serializedEvent = await attachOrganizationName(event);

    res.status(200).json({
      success: true,
      data: { event: serializedEvent },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Update event
 */
export const updateEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existingEvent = await Event.findById(id);
    if (!existingEvent) {
      throw new AppError('Event not found', 404);
    }

    await ensureCanManageOwnedContent(
      req.user,
      Permission.EDIT_EVENT,
      existingEvent.ownerType,
      existingEvent.organizationId ?? null
    );

    const currentOwnership = {
      ownerType: existingEvent.ownerType,
      organizationId: existingEvent.organizationId ?? null,
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
      Permission.EDIT_EVENT
    );

    if (!canMoveOwnership) {
      throw new AppError('You cannot reassign ownership for this event', 403);
    }

    const updates = buildEventUpdatePayload(req.body);
    const bodyHtml =
      typeof updates.bodyHtml === 'string'
        ? updates.bodyHtml
        : typeof req.body.description === 'string'
          ? req.body.description
          : undefined;
    const imageUrl = typeof req.body.imageUrl === 'string' ? req.body.imageUrl : undefined;
    const imageId = typeof req.body.imageId === 'string' ? req.body.imageId : undefined;

    if (updates.startDate && updates.endDate) {
      ensureValidEventDateRange(updates.startDate, updates.endDate);
    } else if (updates.startDate || updates.endDate) {
      ensureValidEventDateRange(
        updates.startDate ?? existingEvent.startDate,
        updates.endDate ?? existingEvent.endDate
      );
    }

    if (bodyHtml !== undefined) {
      updates.bodyHtml = bodyHtml;
      (updates as Record<string, unknown>).description = buildLegacyPlainText(bodyHtml);
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
        (updates.coverImage as typeof existingEvent.coverImage | undefined) ?? existingEvent.coverImage;
      updates.gallery = normalizeGalleryExcludingCover(req.body.gallery, effectiveCoverImage);
    }

    if (req.body.sections !== undefined) {
      updates.sections = normalizeSections(req.body.sections);
    }

    if (req.body.schedule !== undefined) {
      updates.schedule = normalizeSchedule(req.body.schedule);
    }

    (updates as Record<string, unknown>).ownerType = nextOwnership.ownerType;
    (updates as Record<string, unknown>).organizationId = nextOwnership.organizationId;

    if (shouldResetApprovalOnEdit(existingEvent.status)) {
      (updates as Record<string, unknown>).status = EventStatus.DRAFT;
      (updates as Record<string, unknown>).approvalSummary = undefined;
    }

    const event = await Event.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('organizer', 'firstName lastName email');

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    logger.info(`Event updated: ${id} by user ${req.user?.userId}`);

    res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: { event },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Delete event
 */
export const deleteEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingEvent = await Event.findById(id);
    if (!existingEvent) {
      throw new AppError('Event not found', 404);
    }

    await ensureCanManageOwnedContent(
      req.user,
      Permission.DELETE_EVENT,
      existingEvent.ownerType,
      existingEvent.organizationId ?? null
    );

    const event = await Event.findByIdAndDelete(id);

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (event.imageId) {
      await deleteFromCloudinary(event.imageId);
    }

    logger.info(`Event deleted: ${id} by user ${req.user?.userId}`);

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error) {
    throw error;
  }
};

export const submitEventForApproval = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const event = await Event.findById(id).populate('organizer', 'firstName lastName email');

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (event.status !== EventStatus.DRAFT) {
    throw new AppError('Only draft events can be submitted for approval', 400);
  }

  await ensureCanManageOwnedContent(
    req.user,
    Permission.SUBMIT_CONTENT_FOR_APPROVAL,
    event.ownerType,
    event.organizationId ?? null
  );

  const fromStatus = event.status;
  event.status = EventStatus.PENDING_APPROVAL;
  event.approvalSummary = buildSubmittedApprovalSummary(req.user!.userId, event.approvalSummary);
  await event.save();
  await recordContentApprovalAction({
    contentType: 'event',
    contentId: String(event._id),
    actorUserId: req.user!.userId,
    action: 'submitted',
    fromStatus,
    toStatus: event.status,
    comment: typeof req.body.comment === 'string' ? req.body.comment.trim() : undefined,
  });

  res.status(200).json({
    success: true,
    message: 'Event submitted for approval',
    data: { event },
  });
};

export const approveEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const event = await Event.findById(id).populate('organizer', 'firstName lastName email');

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  ensureFullAdminApprover(req.user);

  if (event.status !== EventStatus.PENDING_APPROVAL) {
    throw new AppError('Only pending approval events can be approved', 400);
  }

  const fromStatus = event.status;
  event.status = EventStatus.APPROVED;
  event.approvalSummary = buildApprovedApprovalSummary(req.user!.userId, event.approvalSummary);
  await event.save();
  await recordContentApprovalAction({
    contentType: 'event',
    contentId: String(event._id),
    actorUserId: req.user!.userId,
    action: 'approved',
    fromStatus,
    toStatus: event.status,
    comment: typeof req.body.comment === 'string' ? req.body.comment.trim() : undefined,
  });

  res.status(200).json({
    success: true,
    message: 'Event approved successfully',
    data: { event },
  });
};

export const rejectEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  const event = await Event.findById(id).populate('organizer', 'firstName lastName email');

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  ensureFullAdminApprover(req.user);

  if (event.status !== EventStatus.PENDING_APPROVAL) {
    throw new AppError('Only pending approval events can be rejected', 400);
  }

  if (!reason) {
    throw new AppError('Rejection reason is required', 400);
  }

  const fromStatus = event.status;
  event.status = EventStatus.REJECTED;
  event.approvalSummary = buildRejectedApprovalSummary(req.user!.userId, reason, event.approvalSummary);
  await event.save();
  await recordContentApprovalAction({
    contentType: 'event',
    contentId: String(event._id),
    actorUserId: req.user!.userId,
    action: 'rejected',
    fromStatus,
    toStatus: event.status,
    reason,
    comment: typeof req.body.comment === 'string' ? req.body.comment.trim() : undefined,
  });

  res.status(200).json({
    success: true,
    message: 'Event rejected successfully',
    data: { event },
  });
};

export const publishEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id).populate('organizer', 'firstName lastName email');

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    await ensureCanManageOwnedContent(
      req.user,
      Permission.PUBLISH_EVENT,
      event.ownerType,
      event.organizationId ?? null
    );

    if (!canPublishFromWorkflowStatus(event.status)) {
      throw new AppError('Only draft or approved events can be published', 400);
    }

    const fromStatus = event.status;
    event.status = EventStatus.PUBLISHED;
    event.publishedAt = new Date();
    event.cancelledAt = undefined;
    event.completedAt = undefined;
    await event.save();
    await recordContentApprovalAction({
      contentType: 'event',
      contentId: String(event._id),
      actorUserId: req.user!.userId,
      action: 'published',
      fromStatus,
      toStatus: event.status,
    });

    logger.info(`Event published: ${id} by user ${req.user?.userId}`);

    res.status(200).json({
      success: true,
      message: 'Event published successfully',
      data: { event },
    });
  } catch (error) {
    throw error;
  }
};

export const cancelEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id).populate('organizer', 'firstName lastName email');

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (event.status !== EventStatus.PUBLISHED) {
      throw new AppError('Only published events can be cancelled', 400);
    }

    await ensureCanManageOwnedContent(
      req.user,
      Permission.CANCEL_EVENT,
      event.ownerType,
      event.organizationId ?? null
    );

    event.status = EventStatus.CANCELLED;
    event.cancelledAt = new Date();
    await event.save();

    logger.info(`Event cancelled: ${id} by user ${req.user?.userId}`);

    res.status(200).json({
      success: true,
      message: 'Event cancelled successfully',
      data: { event },
    });
  } catch (error) {
    throw error;
  }
};

export const completeEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id).populate('organizer', 'firstName lastName email');

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (event.status !== EventStatus.PUBLISHED) {
      throw new AppError('Only published events can be completed', 400);
    }

    await ensureCanManageOwnedContent(
      req.user,
      Permission.COMPLETE_EVENT,
      event.ownerType,
      event.organizationId ?? null
    );

    event.status = EventStatus.COMPLETED;
    event.completedAt = new Date();
    await event.save();

    logger.info(`Event completed: ${id} by user ${req.user?.userId}`);

    res.status(200).json({
      success: true,
      message: 'Event completed successfully',
      data: { event },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Join/leave are deprecated. Use the student registration flow instead.
 * These routes remain for backward compatibility and return a helpful redirect.
 */
export const joinEvent = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    message:
      'Public join is deprecated. Students should use POST /api/student/events/:id/register instead.',
    data: { redirect: '/student/login' },
  });
};

export const leaveEvent = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    message:
      'Public leave is deprecated. Students should use POST /api/student/events/:id/cancel-registration instead.',
    data: { redirect: '/student/login' },
  });
};
