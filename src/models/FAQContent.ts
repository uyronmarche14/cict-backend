import mongoose, { Schema } from 'mongoose';
import { IFAQContent } from '../types';

const faqTopicSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const faqEntrySchema = new Schema(
  {
    category: {
      type: String,
      required: true,
      trim: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const faqContentSchema = new Schema<IFAQContent>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      default: 'landing',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      required: true,
      trim: true,
    },
    topics: {
      type: [faqTopicSchema],
      default: [],
    },
    questions: {
      type: [faqEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IFAQContent>('FAQContent', faqContentSchema);
