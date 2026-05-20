import mongoose, { Schema } from 'mongoose';
import { ContentOwnerType, INews, NewsStatus } from '../types';

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

const newsSchema = new Schema<INews>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    content: {
      type: String,
      default: '',
    },
    bodyHtml: {
      type: String,
      required: [true, 'Body content is required'],
    },
    excerpt: {
      type: String,
      required: [true, 'Excerpt is required'],
      maxlength: [500, 'Excerpt cannot exceed 500 characters'],
    },
    author: {
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
    approvalSummary: {
      type: approvalSummarySchema,
      default: undefined,
    },
    processInstanceId: {
      type: String,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
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

// Index for better query performance
newsSchema.index({ status: 1, publishedAt: -1 });
newsSchema.index({ author: 1 });
newsSchema.index({ tags: 1 });
newsSchema.index({ ownerType: 1, organizationId: 1 });

// Auto-set publishedAt when status changes to published
newsSchema.pre('validate', function () {
    if (!this.bodyHtml && this.content) {
        this.bodyHtml = `<p>${this.content}</p>`;
    }
});

newsSchema.pre('save', function () {
    if (this.isModified('status') && this.status === NewsStatus.PUBLISHED && !this.publishedAt) {
        this.publishedAt = new Date();
    }
    
    if (this.isModified('status') && this.status === NewsStatus.ARCHIVED && !this.archivedAt) {
        this.archivedAt = new Date();
    }
});

const News = mongoose.model<INews>('News', newsSchema);

export default News;
