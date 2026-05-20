import mongoose, { Schema } from 'mongoose';
import { IProcessInstance } from '../types';

const processNodeSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['start', 'task', 'approval', 'document_requirement', 'comment_review', 'end'],
      required: true,
    },
    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
    },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const processEdgeSchema = new Schema(
  {
    id: { type: String, required: true },
    source: { type: String, required: true },
    target: { type: String, required: true },
    label: { type: String },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const processInstanceSchema = new Schema<IProcessInstance>(
  {
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'ProcessTemplate',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'completed', 'archived'],
      default: 'draft',
    },
    linkedContentType: {
      type: String,
      enum: ['news', 'announcement', 'event'],
    },
    linkedContentId: {
      type: String,
      trim: true,
    },
    organizationId: {
      type: String,
      trim: true,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedTo: {
      type: [String],
      default: [],
    },
    nodesSnapshot: {
      type: [processNodeSchema],
      default: [],
    },
    edgesSnapshot: {
      type: [processEdgeSchema],
      default: [],
    },
    currentNodeIds: {
      type: [String],
      default: [],
    },
    comments: {
      type: [
        new Schema(
          {
            authorId: { type: String, required: true },
            body: { type: String, required: true, trim: true },
            createdAt: { type: Date, required: true, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    requirements: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            label: { type: String, required: true, trim: true },
            completed: { type: Boolean, default: false },
            completedBy: { type: String },
            completedAt: { type: Date },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    approvalSteps: {
      type: [
        new Schema(
          {
            nodeId: { type: String, required: true },
            status: {
              type: String,
              enum: ['pending', 'approved', 'rejected'],
              default: 'pending',
            },
            actorId: { type: String },
            actedAt: { type: Date },
            reason: { type: String, trim: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

processInstanceSchema.index({ linkedContentType: 1, linkedContentId: 1 });
processInstanceSchema.index({ organizationId: 1, status: 1 });

const ProcessInstance = mongoose.model<IProcessInstance>('ProcessInstance', processInstanceSchema);

export default ProcessInstance;
