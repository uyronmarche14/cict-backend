import mongoose, { Schema } from 'mongoose';
import { IActivityLog } from '../types';

const activityLogSchema = new Schema<IActivityLog>(
  {
    user: {
      type: String,
      ref: 'User',
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
    },
    resource: {
      type: String,
      required: [true, 'Resource is required'],
      trim: true,
    },
    resourceId: {
      type: String,
    },
    details: {
      type: Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ resource: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });

// TTL index to auto-delete logs older than 90 days
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);

export default ActivityLog;
