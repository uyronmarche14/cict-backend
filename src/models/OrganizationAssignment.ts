import mongoose, { Schema } from 'mongoose';
import { IOrganizationAssignment } from '../types';

const organizationAssignmentSchema = new Schema<IOrganizationAssignment>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    organizationId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    role: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

organizationAssignmentSchema.index({ user: 1, organizationId: 1 }, { unique: true });

const OrganizationAssignment = mongoose.model<IOrganizationAssignment>(
  'OrganizationAssignment',
  organizationAssignmentSchema
);

export default OrganizationAssignment;
