import mongoose, { Schema } from 'mongoose';
import { IEvent, EventStatus } from '../types';

const eventSchema = new Schema<IEvent>(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [100, 'Title cannot be more than 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Event description is required'],
    },
    excerpt: {
      type: String,
      required: [true, 'Event excerpt is required'],
      maxlength: [200, 'Excerpt cannot be more than 200 characters'],
    },
    organizer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
    },
    status: {
      type: String,
      enum: Object.values(EventStatus),
      default: EventStatus.DRAFT,
    },
    attendees: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    maxAttendees: {
      type: Number,
      default: 0, // 0 means unlimited
    },
    imageUrl: {
      type: String,
    },
    imageId: {
      type: String,
    },
    tags: [{
      type: String,
      trim: true,
    }],
    isRegistrationOpen: {
      type: Boolean,
      default: true,
    }
  },
  {
    timestamps: true,
  }
);

// Index for getting upcoming events
eventSchema.index({ startDate: 1, status: 1 });

const Event = mongoose.model<IEvent>('Event', eventSchema);

export default Event;
