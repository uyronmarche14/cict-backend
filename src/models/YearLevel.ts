import mongoose, { Schema } from 'mongoose';
import { IYearLevel } from '../types';

const yearLevelSchema = new Schema<IYearLevel>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    numericLevel: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
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

yearLevelSchema.index({ sortOrder: 1, numericLevel: 1 });

const YearLevel = mongoose.model<IYearLevel>('YearLevel', yearLevelSchema);

export default YearLevel;
