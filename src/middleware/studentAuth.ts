import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Student from '../models/Student';
import { IAuthenticatedStudent, IStudentJWTPayload, StudentStatus } from '../types';
import logger from '../utils/logger';

export interface StudentAuthRequest extends Request {
  student?: IAuthenticatedStudent;
  studentSessionId?: string;
}

const getStudentTokenFromRequest = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
};

export const authenticateStudent = async (
  req: StudentAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = getStudentTokenFromRequest(req);

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'No student token provided.',
      });
      return;
    }

    const jwtSecret = process.env.STUDENT_JWT_SECRET || process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('Student JWT secret is not configured');
      res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as IStudentJWTPayload;
    if (decoded.actorType !== 'student') {
      res.status(401).json({
        success: false,
        message: 'Invalid student token',
      });
      return;
    }

    const student = await Student.findById(decoded.studentId);
    if (!student) {
      res.status(401).json({
        success: false,
        message: 'Student no longer exists',
      });
      return;
    }

    if (!student.isActive || student.status !== StudentStatus.ACTIVE) {
      res.status(403).json({
        success: false,
        message: 'Student account is not active',
      });
      return;
    }

    req.student = {
      studentId: String(student._id),
      studentNumber: student.studentNumber,
      email: student.email,
      firstName: student.firstName,
      lastName: student.lastName,
      middleName: student.middleName,
      status: student.status,
      isActive: student.isActive,
      qrVersion: student.qrVersion,
      programId: String(student.programId),
      yearLevelId: String(student.yearLevelId),
      sectionId: String(student.sectionId),
    };
    req.studentSessionId = decoded.sessionId;

    next();
  } catch (error: unknown) {
    const typedError = error as { name?: string };
    logger.error('Student authentication error:', error);

    if (typedError.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Student token has expired',
      });
      return;
    }

    res.status(401).json({
      success: false,
      message: 'Student authentication failed',
    });
  }
};
