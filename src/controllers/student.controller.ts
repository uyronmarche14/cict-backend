import { Response } from 'express';
import Student from '../models/Student';
import { StudentAuthRequest } from '../middleware/studentAuth';
import { AppError } from '../middleware/errorHandler';

export const getOwnStudentProfile = async (
  req: StudentAuthRequest,
  res: Response
): Promise<void> => {
  if (!req.student) {
    throw new AppError('Student not authenticated', 401);
  }

  const student = await Student.findById(req.student.studentId)
    .populate('programId', 'code name')
    .populate('yearLevelId', 'code label numericLevel')
    .populate('sectionId', 'name displayName');

  if (!student) {
    throw new AppError('Student not found', 404);
  }

  res.status(200).json({
    success: true,
    data: { student },
  });
};
