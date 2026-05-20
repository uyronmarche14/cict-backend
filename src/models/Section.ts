import mongoose, { Schema } from 'mongoose';
import { ISection } from '../types';

const sectionSchema = new Schema<ISection>(
  {
    programId: {
      type: Schema.Types.ObjectId,
      ref: 'Program',
      required: true,
      index: true,
    },
    yearLevelId: {
      type: Schema.Types.ObjectId,
      ref: 'YearLevel',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
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

sectionSchema.index({ programId: 1, yearLevelId: 1, name: 1 }, { unique: true });

const Section = mongoose.model<ISection>('Section', sectionSchema);

export default Section;
