import mongoose, { Schema } from 'mongoose';
import { IProcessTemplate } from '../types';

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
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
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

const processTemplateSchema = new Schema<IProcessTemplate>(
  {
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
    processType: {
      type: String,
      required: true,
      trim: true,
    },
    organizationScope: {
      type: String,
      trim: true,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    nodes: {
      type: [processNodeSchema],
      default: [],
    },
    edges: {
      type: [processEdgeSchema],
      default: [],
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

processTemplateSchema.index({ processType: 1, organizationScope: 1, isActive: 1 });

const ProcessTemplate = mongoose.model<IProcessTemplate>('ProcessTemplate', processTemplateSchema);

export default ProcessTemplate;
