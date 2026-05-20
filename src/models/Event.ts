import mongoose, { Schema } from 'mongoose';
import { ContentOwnerType, IEvent, EventStatus } from '../types';

const mediaAssetSchema = new Schema(
  {
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    imageId: {
      type: String,
      trim: true,
    },
    assetFingerprint: {
      type: String,
      trim: true,
    },
    alt: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Alt text cannot exceed 200 characters'],
    },
    caption: {
      type: String,
      trim: true,
      maxlength: [300, 'Caption cannot exceed 300 characters'],
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const contentSectionSchema = new Schema(
  {
    heading: {
      type: String,
      required: true,
      trim: true,
      maxlength: [120, 'Section heading cannot exceed 120 characters'],
    },
    style: {
      type: String,
      enum: ['default', 'callout', 'checklist'],
      default: 'default',
    },
    bodyHtml: {
      type: String,
      trim: true,
      default: '',
    },
    items: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const scheduleItemSchema = new Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: [80, 'Schedule label cannot exceed 80 characters'],
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [160, 'Schedule title cannot exceed 160 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [400, 'Schedule description cannot exceed 400 characters'],
    },
  },
  { _id: false }
);

const approvalSummarySchema = new Schema(
  {
    submittedAt: Date,
    submittedBy: String,
    approvedAt: Date,
    approvedBy: String,
    rejectedAt: Date,
    rejectedBy: String,
    rejectionReason: String,
  },
  { _id: false }
);

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
      default: '',
    },
    bodyHtml: {
      type: String,
      required: [true, 'Event body content is required'],
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
    ownerType: {
      type: String,
      enum: Object.values(ContentOwnerType),
      default: ContentOwnerType.SYSTEM,
      required: true,
    },
    organizationId: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
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
    publishedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    attendees: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    maxAttendees: {
      type: Number,
      default: 0, // 0 means unlimited
    },
    sections: {
      type: [contentSectionSchema],
      default: [],
    },
    coverImage: {
      type: mediaAssetSchema,
      required: false,
    },
    gallery: {
      type: [mediaAssetSchema],
      default: [],
    },
    schedule: {
      type: [scheduleItemSchema],
      default: [],
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
    },
    registeredCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    checkedInCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    registrationCloseAt: {
      type: Date,
    },
    allowWalkIns: {
      type: Boolean,
      default: false,
    },
    targetProgramIds: {
      type: [String],
      default: [],
    },
    targetYearLevelIds: {
      type: [String],
      default: [],
    },
    targetSectionIds: {
      type: [String],
      default: [],
    },
    approvalSummary: {
      type: approvalSummarySchema,
      default: undefined,
    },
    processInstanceId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for getting upcoming events
eventSchema.index({ startDate: 1, status: 1 });
eventSchema.index({ ownerType: 1, organizationId: 1 });

eventSchema.pre('validate', function () {
    if (!this.bodyHtml && this.description) {
        this.bodyHtml = `<p>${this.description}</p>`;
    }
});

const Event = mongoose.model<IEvent>('Event', eventSchema);

export default Event;
