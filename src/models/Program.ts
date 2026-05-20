import mongoose, { Schema } from 'mongoose';
import { IProgram } from '../types';

const programSchema = new Schema<IProgram>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

programSchema.index({ sortOrder: 1, code: 1 });

const Program = mongoose.model<IProgram>('Program', programSchema);

export default Program;
