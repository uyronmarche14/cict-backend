import { Response } from 'express';
import Student from '../models/Student';
import Program from '../models/Program';
import YearLevel from '../models/YearLevel';
import Section from '../models/Section';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { StudentStatus } from '../types';

const ensureAcademicReferences = async (
  programId: string,
  yearLevelId: string,
  sectionId: string
) => {
  const [program, yearLevel, section] = await Promise.all([
    Program.findById(programId),
    YearLevel.findById(yearLevelId),
    Section.findById(sectionId),
  ]);

  if (!program) {
    throw new AppError('Program not found', 404);
  }
  if (!yearLevel) {
    throw new AppError('Year level not found', 404);
  }
  if (!section) {
    throw new AppError('Section not found', 404);
  }
  if (String(section.programId) !== programId || String(section.yearLevelId) !== yearLevelId) {
    throw new AppError('Section does not belong to the selected program and year level', 400);
  }
};

export const getStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    page = 1,
    limit = 10,
    search,
    programId,
    yearLevelId,
    sectionId,
    status,
    isActive,
  } = req.query;

  const query: Record<string, unknown> = {};

  if (typeof programId === 'string' && programId) {
    query.programId = programId;
  }
  if (typeof yearLevelId === 'string' && yearLevelId) {
    query.yearLevelId = yearLevelId;
  }
  if (typeof sectionId === 'string' && sectionId) {
    query.sectionId = sectionId;
  }
  if (typeof status === 'string' && status) {
    query.status = status;
  }
  if (typeof isActive === 'string' && isActive) {
    query.isActive = isActive === 'true';
  }
  if (typeof search === 'string' && search.trim()) {
    query.$or = [
      { studentNumber: { $regex: search.trim(), $options: 'i' } },
      { email: { $regex: search.trim(), $options: 'i' } },
      { firstName: { $regex: search.trim(), $options: 'i' } },
      { lastName: { $regex: search.trim(), $options: 'i' } },
    ];
  }

  const pageNumber = Math.max(1, Number(page));
  const limitNumber = Math.max(1, Math.min(100, Number(limit)));
  const skip = (pageNumber - 1) * limitNumber;

  const [students, total] = await Promise.all([
    Student.find(query)
      .populate('programId', 'code name')
      .populate('yearLevelId', 'code label numericLevel')
      .populate('sectionId', 'name displayName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber),
    Student.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: {
      students,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        pages: Math.ceil(total / limitNumber),
      },
    },
  });
};

export const getStudentById = async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await Student.findById(req.params.id)
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

export const createStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    studentNumber,
    email,
    password,
    firstName,
    lastName,
    middleName,
    programId,
    yearLevelId,
    sectionId,
    status = StudentStatus.PENDING,
    isActive = false,
  } = req.body;

  const [studentNumberConflict, emailConflict] = await Promise.all([
    Student.findOne({ studentNumber: String(studentNumber).trim().toUpperCase() }),
    email ? Student.findOne({ email: String(email).trim().toLowerCase() }) : Promise.resolve(null),
  ]);

  if (studentNumberConflict) {
    throw new AppError('Student number already exists', 409);
  }
  if (emailConflict) {
    throw new AppError('Student email already exists', 409);
  }

  await ensureAcademicReferences(programId, yearLevelId, sectionId);

  const student = await Student.create({
    studentNumber,
    email,
    passwordHash: password,
    firstName,
    lastName,
    middleName,
    programId,
    yearLevelId,
    sectionId,
    status,
    isActive,
  });

  const populatedStudent = await Student.findById(student._id)
    .populate('programId', 'code name')
    .populate('yearLevelId', 'code label numericLevel')
    .populate('sectionId', 'name displayName');

  res.status(201).json({
    success: true,
    data: { student: populatedStudent },
  });
};

export const updateStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  const existingStudent = await Student.findById(req.params.id);
  if (!existingStudent) {
    throw new AppError('Student not found', 404);
  }

  const nextStudentNumber = req.body.studentNumber
    ? String(req.body.studentNumber).trim().toUpperCase()
    : existingStudent.studentNumber;
  const nextEmail =
    typeof req.body.email === 'string' && req.body.email.trim()
      ? req.body.email.trim().toLowerCase()
      : undefined;

  const [studentNumberConflict, emailConflict] = await Promise.all([
    Student.findOne({ _id: { $ne: req.params.id }, studentNumber: nextStudentNumber }),
    nextEmail
      ? Student.findOne({ _id: { $ne: req.params.id }, email: nextEmail })
      : Promise.resolve(null),
  ]);

  if (studentNumberConflict) {
    throw new AppError('Student number already exists', 409);
  }
  if (emailConflict) {
    throw new AppError('Student email already exists', 409);
  }

  const nextProgramId = req.body.programId ?? String(existingStudent.programId);
  const nextYearLevelId = req.body.yearLevelId ?? String(existingStudent.yearLevelId);
  const nextSectionId = req.body.sectionId ?? String(existingStudent.sectionId);
  await ensureAcademicReferences(nextProgramId, nextYearLevelId, nextSectionId);

  const updates: Record<string, unknown> = {
    studentNumber: req.body.studentNumber,
    email: req.body.email,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    middleName: req.body.middleName,
    programId: req.body.programId,
    yearLevelId: req.body.yearLevelId,
    sectionId: req.body.sectionId,
    status: req.body.status,
    isActive: req.body.isActive,
  };

  if (typeof req.body.password === 'string' && req.body.password.trim().length >= 8) {
    updates.passwordHash = req.body.password;
  }

  const student = await Student.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  )
    .populate('programId', 'code name')
    .populate('yearLevelId', 'code label numericLevel')
    .populate('sectionId', 'name displayName');

  res.status(200).json({
    success: true,
    data: { student },
  });
};

export const updateStudentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, isActive } = req.body as { status: StudentStatus; isActive: boolean };

  const student = await Student.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        status,
        isActive,
      },
    },
    { new: true, runValidators: true }
  )
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
