import mongoose, { Schema } from 'mongoose';
import { IRole, Permission } from '../types';

const roleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: [true, 'Role name is required'],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Role description is required'],
      trim: true,
    },
    permissions: {
      type: [String],
      enum: Object.values(Permission),
      default: [],
    },
    isSystemRole: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent deletion of system roles
roleSchema.pre('deleteOne', { document: true, query: false }, async function (this: any) {
  if (this.isSystemRole) {
    throw new Error('Cannot delete system roles');
  }
});

const Role = mongoose.model<IRole>('Role', roleSchema);

export default Role;
