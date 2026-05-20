import mongoose, { Schema } from 'mongoose';
import { IStudentSession } from '../types';

const studentSessionSchema = new Schema<IStudentSession>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    deviceLabel: {
      type: String,
      trim: true,
    },
    platform: {
      type: String,
      trim: true,
    },
    lastUsedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    revokedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

studentSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const StudentSession = mongoose.model<IStudentSession>('StudentSession', studentSessionSchema);

export default StudentSession;
