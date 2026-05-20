import mongoose, { Schema } from 'mongoose';
import { AttendanceScanResult, IEventAttendanceLog } from '../types';

const eventAttendanceLogSchema = new Schema<IEventAttendanceLog>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    registrationId: {
      type: Schema.Types.ObjectId,
      ref: 'EventRegistration',
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
    },
    scanType: {
      type: String,
      enum: ['entry', 'manual'],
      default: 'entry',
    },
    result: {
      type: String,
      enum: Object.values(AttendanceScanResult),
      required: true,
    },
    scannedByAdminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    scannedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    scannerDevice: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

eventAttendanceLogSchema.index({ eventId: 1, studentId: 1, createdAt: -1 });

const EventAttendanceLog = mongoose.model<IEventAttendanceLog>(
  'EventAttendanceLog',
  eventAttendanceLogSchema
);

export default EventAttendanceLog;
