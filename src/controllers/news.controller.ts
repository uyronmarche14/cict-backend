import { Response } from 'express';
import News from '../models/News';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { NewsStatus } from '../types';
import logger from '../utils/logger';
import { deleteFromCloudinary } from '../middleware/upload';

/**
 * Create new news article
 */
export const createNews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
        throw new AppError('User not authenticated', 401);
    }
    
    const { title, content, excerpt, tags, imageUrl, imageId, status } = req.body;
    
    const news = await News.create({
      title,
      content,
      excerpt,
      author: req.user.userId,
      tags: tags || [],
      imageUrl,
      imageId,
      status: status || NewsStatus.DRAFT,
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
    const { status, page = 1, limit = 10, search } = req.query;
    
    const query: any = {};
    
    // If user is not authenticated, they can ONLY see published news
    if (!req.user) {
        query.status = NewsStatus.PUBLISHED;
    } else {
        // Authenticated user can filter by status if provided, otherwise might see all?
        // Usually, dashboard wants specific status.
        if (status) {
            query.status = status;
        }
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const [news, total] = await Promise.all([
      News.find(query)
        .populate('author', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      News.countDocuments(query),
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        news,
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

    // If unauthenticated, ensure news is published
    if (!req.user && news.status !== NewsStatus.PUBLISHED) {
        throw new AppError('News article not found', 404);
    }
    
    res.status(200).json({
      success: true,
      data: { news },
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
    const updates = req.body;
    
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
    
    const news = await News.findByIdAndDelete(id);
    
    if (!news) {
      throw new AppError('News article not found', 404);
    }

    // Delete image from Cloudinary if exists
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
    
    const news = await News.findByIdAndUpdate(
      id,
      { status: NewsStatus.PUBLISHED },
      { new: true }
    ).populate('author', 'firstName lastName email');
    
    if (!news) {
      throw new AppError('News article not found', 404);
    }
    
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
    
    const news = await News.findByIdAndUpdate(
      id,
      { status: NewsStatus.ARCHIVED },
      { new: true }
    ).populate('author', 'firstName lastName email');
    
    if (!news) {
      throw new AppError('News article not found', 404);
    }
    
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
