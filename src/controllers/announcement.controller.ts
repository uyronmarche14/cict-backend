import { Request, Response } from 'express';
import Announcement from '../models/Announcement';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { NewsStatus } from '../types';
import logger from '../utils/logger';

import { deleteFromCloudinary } from '../middleware/upload';

/**
 * Create new announcement
 */
export const createAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }
    
    const { title, content, priority, status, expiresAt, targetAudience, imageUrl, imageId } = req.body;
    
    const announcement = await Announcement.create({
      title,
      content,
      author: req.user.userId,
      priority,
      status: status || NewsStatus.DRAFT,
      expiresAt,
      targetAudience: targetAudience || ['all'],
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
export const getAllAnnouncements = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, priority, page = 1, limit = 10, search } = req.query;
    
    const query: any = {};
    
    if (status) {
      query.status = status;
    }

    if (priority) {
        query.priority = priority;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const [announcements, total] = await Promise.all([
      Announcement.find(query)
        .populate('author', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Announcement.countDocuments(query),
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        announcements,
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
export const getAnnouncementById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findById(id).populate('author', 'firstName lastName email');
    
    if (!announcement) {
      throw new AppError('Announcement not found', 404);
    }
    
    res.status(200).json({
      success: true,
      data: { announcement },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Update announcement
 */
export const updateAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
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

/**
 * Delete announcement
 */
export const deleteAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findByIdAndDelete(id);
    
    if (!announcement) {
      throw new AppError('Announcement not found', 404);
    }

    // Delete image from Cloudinary if exists
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
    
    const announcement = await Announcement.findByIdAndUpdate(
      id,
      { status: NewsStatus.PUBLISHED },
      { new: true }
    ).populate('author', 'firstName lastName email');
    
    if (!announcement) {
      throw new AppError('Announcement not found', 404);
    }
    
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
    
    const announcement = await Announcement.findByIdAndUpdate(
      id,
      { status: NewsStatus.ARCHIVED },
      { new: true }
    ).populate('author', 'firstName lastName email');
    
    if (!announcement) {
      throw new AppError('Announcement not found', 404);
    }
    
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
