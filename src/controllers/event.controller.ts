import { Response } from 'express';
import Event from '../models/Event';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { EventStatus } from '../types';
import logger from '../utils/logger';
import { deleteFromCloudinary } from '../middleware/upload';

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
      excerpt, 
      startDate, 
      endDate, 
      location, 
      maxAttendees, 
      tags, 
      imageUrl, 
      imageId 
    } = req.body;
    
    if (new Date(startDate) > new Date(endDate)) {
        throw new AppError('Start date cannot be after end date', 400);
    }

    const event = await Event.create({
      title,
      description,
      excerpt,
      organizer: req.user.userId,
      startDate,
      endDate,
      location,
      maxAttendees,
      tags: tags || [],
      imageUrl,
      imageId,
      status: EventStatus.DRAFT,
      isRegistrationOpen: true,
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
    const { status, page = 1, limit = 10, search, upcoming } = req.query;
    
    const query: any = {};
    
    // If not authenticated, only show published
    if (!req.user) {
        query.status = EventStatus.PUBLISHED;
    } else if (status) {
        query.status = status;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    if (upcoming === 'true') {
        query.endDate = { $gte: new Date() };
    }
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const [events, total] = await Promise.all([
      Event.find(query)
        .populate('organizer', 'firstName lastName email')
        .sort({ startDate: 1 }) // Closest events first
        .skip(skip)
        .limit(Number(limit)),
      Event.countDocuments(query),
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        events,
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
      .populate('attendees', 'firstName lastName email'); // Populate attendees for admin/organizer?
    
    if (!event) {
      throw new AppError('Event not found', 404);
    }

    if (!req.user && event.status !== EventStatus.PUBLISHED) {
        throw new AppError('Event not found', 404);
    }
    
    res.status(200).json({
      success: true,
      data: { event },
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
    const updates = req.body;
    
    // Validate dates if they are being updated
    if (updates.startDate && updates.endDate) {
        if (new Date(updates.startDate) > new Date(updates.endDate)) {
            throw new AppError('Start date cannot be after end date', 400);
        }
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

/**
 * Join event
 */
export const joinEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
        throw new AppError('User not authenticated', 401);
    }

    const event = await Event.findById(id);
    if (!event) {
        throw new AppError('Event not found', 404);
    }

    if (event.status !== EventStatus.PUBLISHED && event.status !== EventStatus.COMPLETED) {
         // Allow joining somewhat completed events? No, probably not.
         // Usually validation on status is needed. Assume they can only join PUBLISHED.
    }
    
    if (event.status !== EventStatus.PUBLISHED) {
        throw new AppError('Cannot join a non-published event', 400);
    }

    if (!event.isRegistrationOpen) {
        throw new AppError('Registration is closed for this event', 400);
    }

    // Check if max attendees reached
    if (event.maxAttendees && event.maxAttendees > 0 && event.attendees.length >= event.maxAttendees) {
        throw new AppError('Event is full', 400);
    }

    // Check if already joined
    const isJoined = event.attendees.some(attendeeId => attendeeId.toString() === userId.toString());
    if (isJoined) {
        throw new AppError('You have already joined this event', 400);
    }

    event.attendees.push(userId as any);
    await event.save();

    logger.info(`User ${userId} joined event ${id}`);

    res.status(200).json({
        success: true,
        message: 'Successfully joined event',
        data: { event }
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Leave event
 */
export const leaveEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
        throw new AppError('User not authenticated', 401);
    }

    const event = await Event.findById(id);
    if (!event) {
        throw new AppError('Event not found', 404);
    }

    // Check if actually joined
    const isJoined = event.attendees.some(attendeeId => attendeeId.toString() === userId.toString());
    if (!isJoined) {
        throw new AppError('You are not a participant of this event', 400);
    }

    // Use filter to remove
    event.attendees = event.attendees.filter(attendeeId => attendeeId.toString() !== userId.toString());
    await event.save();

    logger.info(`User ${userId} left event ${id}`);

    res.status(200).json({
        success: true,
        message: 'Successfully left event',
        data: { event }
    });

  } catch (error) {
    throw error;
  }
};
