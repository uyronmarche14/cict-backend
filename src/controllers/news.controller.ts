import { Response } from 'express';
import News from '../models/News';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { ContentOwnerType, NewsStatus, Permission } from '../types';
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

const NEWS_EDITABLE_FIELDS = [
  'title',
  'bodyHtml',
  'excerpt',
  'tags',
  'coverImage',
  'gallery',
  'sections',
  'imageUrl',
  'imageId',
] as const;

const buildNewsUpdatePayload = (body: Record<string, unknown>) => {
  const updates: Partial<Record<(typeof NEWS_EDITABLE_FIELDS)[number], unknown>> = {};

  for (const field of NEWS_EDITABLE_FIELDS) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  return updates;
};

const canViewUnpublishedNews = (req: AuthRequest): boolean =>
  !!req.user && hasGlobalPermission(req.user, Permission.VIEW_NEWS);

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
 * Create new news article
 */
export const createNews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }

    const {
      title,
      bodyHtml: rawBodyHtml,
      content,
      excerpt,
      tags,
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
      Permission.CREATE_NEWS,
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

    const news = await News.create({
      title,
      content: buildLegacyPlainText(bodyHtml),
      bodyHtml,
      excerpt,
      author: req.user.userId,
      ownerType: ownership.ownerType,
      organizationId: ownership.organizationId,
      tags: tags || [],
      sections: normalizeSections(sections),
      coverImage: resolvedCoverImage,
      gallery: normalizeGalleryExcludingCover(gallery, resolvedCoverImage),
      imageUrl,
      imageId,
      status: NewsStatus.DRAFT,
    });

    logger.info(`News created: ${news._id} by user ${req.user.userId}`);

    res.status(201).json({
      success: true,
      message: 'News article created successfully',
      data: { news },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Get all news articles
 */
export const getAllNews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, page = 1, limit = 10, search, ownerType, organizationId } = req.query;

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
        status: NewsStatus.PUBLISHED,
        ...buildOwnershipFilter(requestedOwnerType, requestedOrganizationId),
      });
    } else if (hasGlobalPermission(req.user, Permission.VIEW_NEWS)) {
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
        Permission.VIEW_NEWS
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
          { content: { $regex: search, $options: 'i' } },
          { bodyHtml: { $regex: search, $options: 'i' } },
        ],
      });
    }
    const query = conditions.length <= 1 ? conditions[0] ?? {} : { $and: conditions };

    const skip = (Number(page) - 1) * Number(limit);

    const [news, total] = await Promise.all([
      News.find(query)
        .populate('author', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      News.countDocuments(query),
    ]);
    const serializedNews = await attachOrganizationNames(news);

    res.status(200).json({
      success: true,
      data: {
        news: serializedNews,
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
 * Get single news article by ID
 */
export const getNewsById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const news = await News.findById(id).populate('author', 'firstName lastName email');

    if (!news) {
      throw new AppError('News article not found', 404);
    }

    if (!canViewUnpublishedNews(req)) {
      if (news.status !== NewsStatus.PUBLISHED) {
        await ensureCanManageOwnedContent(
          req.user,
          Permission.VIEW_NEWS,
          news.ownerType,
          news.organizationId ?? null
        );
      }
    }

    const serializedNews = await attachOrganizationName(news);

    res.status(200).json({
      success: true,
      data: { news: serializedNews },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Update news article
 */
export const updateNews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existingNews = await News.findById(id);
    if (!existingNews) {
      throw new AppError('News article not found', 404);
    }

    await ensureCanManageOwnedContent(
      req.user,
      Permission.EDIT_NEWS,
      existingNews.ownerType,
      existingNews.organizationId ?? null
    );

    const currentOwnership = {
      ownerType: existingNews.ownerType,
      organizationId: existingNews.organizationId ?? null,
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
      Permission.EDIT_NEWS
    );

    if (!canMoveOwnership) {
      throw new AppError('You cannot reassign ownership for this news article', 403);
    }

    const updates = buildNewsUpdatePayload(req.body);
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
        (updates.coverImage as typeof existingNews.coverImage | undefined) ?? existingNews.coverImage;
      updates.gallery = normalizeGalleryExcludingCover(req.body.gallery, effectiveCoverImage);
    }

    if (req.body.sections !== undefined) {
      updates.sections = normalizeSections(req.body.sections);
    }

    (updates as Record<string, unknown>).ownerType = nextOwnership.ownerType;
    (updates as Record<string, unknown>).organizationId = nextOwnership.organizationId;

    const news = await News.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('author', 'firstName lastName email');

    if (!news) {
      throw new AppError('News article not found', 404);
    }

    logger.info(`News updated: ${id} by user ${req.user?.userId}`);

    res.status(200).json({
      success: true,
      message: 'News article updated successfully',
      data: { news },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Delete news article
 */
export const deleteNews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingNews = await News.findById(id);
    if (!existingNews) {
      throw new AppError('News article not found', 404);
    }

    await ensureCanManageOwnedContent(
      req.user,
      Permission.DELETE_NEWS,
      existingNews.ownerType,
      existingNews.organizationId ?? null
    );

    const news = await News.findByIdAndDelete(id);

    if (!news) {
      throw new AppError('News article not found', 404);
    }

    if (news.imageId) {
      await deleteFromCloudinary(news.imageId);
    }

    logger.info(`News deleted: ${id} by user ${req.user?.userId}`);

    res.status(200).json({
      success: true,
      message: 'News article deleted successfully',
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Publish news article
 */
export const publishNews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const news = await News.findById(id).populate('author', 'firstName lastName email');

    if (!news) {
      throw new AppError('News article not found', 404);
    }

    if (news.status !== NewsStatus.DRAFT) {
      throw new AppError('Only draft news can be published', 400);
    }

    await ensureCanManageOwnedContent(
      req.user,
      Permission.PUBLISH_NEWS,
      news.ownerType,
      news.organizationId ?? null
    );

    news.status = NewsStatus.PUBLISHED;
    news.publishedAt = new Date();
    news.archivedAt = undefined;
    await news.save();

    logger.info(`News published: ${id} by user ${req.user?.userId}`);

    res.status(200).json({
      success: true,
      message: 'News article published successfully',
      data: { news },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Archive news article
 */
export const archiveNews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const news = await News.findById(id).populate('author', 'firstName lastName email');

    if (!news) {
      throw new AppError('News article not found', 404);
    }

    if (news.status !== NewsStatus.PUBLISHED) {
      throw new AppError('Only published news can be archived', 400);
    }

    await ensureCanManageOwnedContent(
      req.user,
      Permission.ARCHIVE_NEWS,
      news.ownerType,
      news.organizationId ?? null
    );

    news.status = NewsStatus.ARCHIVED;
    news.archivedAt = new Date();
    await news.save();

    logger.info(`News archived: ${id} by user ${req.user?.userId}`);

    res.status(200).json({
      success: true,
      message: 'News article archived successfully',
      data: { news },
    });
  } catch (error) {
    throw error;
  }
};
