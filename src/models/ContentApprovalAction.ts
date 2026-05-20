import mongoose, { Schema } from 'mongoose';
import { IContentApprovalAction } from '../types';

const contentApprovalActionSchema = new Schema<IContentApprovalAction>(
  {
    contentType: {
      type: String,
      enum: ['news', 'announcement', 'event'],
      required: true,
    },
    contentId: {
      type: String,
      required: true,
      trim: true,
    },
    action: {
      type: String,
      enum: ['submitted', 'approved', 'rejected', 'published', 'archived', 'returned_to_draft'],
      required: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    comment: {
      type: String,
      trim: true,
    },
    fromStatus: {
      type: String,
      trim: true,
    },
    toStatus: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

contentApprovalActionSchema.index({ contentType: 1, contentId: 1, createdAt: -1 });

const ContentApprovalAction = mongoose.model<IContentApprovalAction>(
  'ContentApprovalAction',
  contentApprovalActionSchema
);

export default ContentApprovalAction;
