import mongoose, { Schema } from 'mongoose';
import { IOrganization } from '../types';

const organizationSchema = new Schema<IOrganization>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    longDescription: {
      type: String,
      required: true,
    },
    logo: {
      type: String,
      required: true,
    },
    banner: {
      type: String,
      required: true,
    },
    established: {
      type: String,
      required: true,
    },
    mission: {
      type: String,
      required: true,
    },
    vision: {
      type: String,
      required: true,
    },
    values: [{
      type: String,
    }],
    achievements: [{
      type: String,
    }],
    members: [{
      id: {
        type: String,
      },
      name: {
        type: String,
        required: true,
      },
      position: {
        type: String,
        required: true,
      },
      photo: {
        type: String,
        required: true,
      },
      bio: {
        type: String,
        required: true,
      },
      joinedDate: String,
      achievements: [String],
      responsibilities: [String],
      skills: [String],
      timeline: [{
        year: String,
        title: String,
        description: String,
        category: {
          type: String,
          enum: ['achievement', 'project', 'milestone', 'award', 'education'],
        },
        details: [String],
      }],
      gallery: [String],
      social: {
        linkedin: String,
        github: String,
        email: String,
      },
    }],
    color: {
      primary: { type: String, required: true },
      secondary: { type: String, required: true },
      accent: { type: String, required: true },
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate members with same ID within an organization (though schema validation for arrays is tricky, we'll handle in controller logic mostly, or we could add specific validators)
// But since member ID is just a string, we assume it's unique enough or managed by the frontend/controller.

export default mongoose.model<IOrganization>('Organization', organizationSchema);
