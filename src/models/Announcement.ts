import mongoose, { Schema } from 'mongoose';
import { IAnnouncement, AnnouncementPriority, AnnouncementType, NewsStatus } from '../types';

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    priority: {
      type: String,
      enum: Object.values(AnnouncementPriority),
      default: AnnouncementPriority.MEDIUM,
    },
    type: {
      type: String,
      enum: Object.values(AnnouncementType),
      default: AnnouncementType.GENERAL,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: Object.values(NewsStatus),
      default: NewsStatus.DRAFT,
    },
    publishedAt: {
      type: Date,
    },
    archivedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
    targetAudience: {
      type: [String],
      default: ['all'],
    },
    imageUrl: {
      type: String,
    },
    imageId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
announcementSchema.index({ status: 1, priority: -1, publishedAt: -1 });
announcementSchema.index({ author: 1 });
announcementSchema.index({ expiresAt: 1 });

// Auto-set publishedAt when status changes to published
announcementSchema.pre('save', function () {
    if (this.isModified('status') && this.status === NewsStatus.PUBLISHED && !this.publishedAt) {
        this.publishedAt = new Date();
    }
    
    if (this.isModified('status') && this.status === NewsStatus.ARCHIVED && !this.archivedAt) {
        this.archivedAt = new Date();
    }
});

const Announcement = mongoose.model<IAnnouncement>('Announcement', announcementSchema);

export default Announcement;
