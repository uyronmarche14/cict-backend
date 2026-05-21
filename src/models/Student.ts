import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IStudent, StudentStatus } from '../types';

const studentSchema = new Schema<IStudent>(
  {
    studentNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    middleName: {
      type: String,
      trim: true,
    },
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
    sectionId: {
      type: Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(StudentStatus),
      default: StudentStatus.PENDING,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
    },
    qrVersion: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);

studentSchema.index({ programId: 1, yearLevelId: 1, sectionId: 1, status: 1 });

studentSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) {
    return;
  }

  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, rounds);
});

studentSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.passwordHash);
  } catch {
    return false;
  }
};

studentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

const Student = mongoose.model<IStudent>('Student', studentSchema);

export default Student;
