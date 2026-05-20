import mongoose, { Schema } from 'mongoose';
import { EventRegistrationStatus, IEventRegistration } from '../types';

const eventRegistrationSchema = new Schema<IEventRegistration>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(EventRegistrationStatus),
      default: EventRegistrationStatus.REGISTERED,
    },
    qrNonce: {
      type: String,
      required: true,
      trim: true,
    },
    qrIssuedAt: {
      type: Date,
    },
    registeredAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    checkedInAt: {
      type: Date,
    },
    eligibilitySnapshot: {
      programId: String,
      yearLevelId: String,
      sectionId: String,
    },
    scanCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    source: {
      type: String,
      enum: ['self', 'admin', 'walk_in'],
      default: 'self',
    },
  },
  {
    timestamps: true,
  }
);

eventRegistrationSchema.index({ eventId: 1, studentId: 1 }, { unique: true });
eventRegistrationSchema.index({ eventId: 1, status: 1 });

const EventRegistration = mongoose.model<IEventRegistration>(
  'EventRegistration',
  eventRegistrationSchema
);

export default EventRegistration;
