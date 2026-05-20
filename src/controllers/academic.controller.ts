import { Response } from 'express';
import Program from '../models/Program';
import YearLevel from '../models/YearLevel';
import Section from '../models/Section';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const getPrograms = async (_req: AuthRequest, res: Response): Promise<void> => {
  const programs = await Program.find().sort({ sortOrder: 1, code: 1 });
  res.status(200).json({
    success: true,
    data: { programs },
  });
};

export const createProgram = async (req: AuthRequest, res: Response): Promise<void> => {
  const { code, name, isActive = true, sortOrder = 0 } = req.body;
  const existingProgram = await Program.findOne({ code: String(code).trim().toUpperCase() });
  if (existingProgram) {
    throw new AppError('Program code already exists', 409);
  }

  const program = await Program.create({
    code,
    name,
    isActive,
    sortOrder,
  });

  res.status(201).json({
    success: true,
    data: { program },
  });
};

export const updateProgram = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const existingProgram = await Program.findById(id);
  if (!existingProgram) {
    throw new AppError('Program not found', 404);
  }

  if (req.body.code && String(req.body.code).trim().toUpperCase() !== existingProgram.code) {
    const codeConflict = await Program.findOne({ code: String(req.body.code).trim().toUpperCase() });
    if (codeConflict) {
      throw new AppError('Program code already exists', 409);
    }
  }

  const program = await Program.findByIdAndUpdate(
    id,
    {
      $set: {
        code: req.body.code,
        name: req.body.name,
        isActive: req.body.isActive,
        sortOrder: req.body.sortOrder,
      },
    },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    data: { program },
  });
};

export const getYearLevels = async (_req: AuthRequest, res: Response): Promise<void> => {
  const yearLevels = await YearLevel.find().sort({ sortOrder: 1, numericLevel: 1 });
  res.status(200).json({
    success: true,
    data: { yearLevels },
  });
};

export const createYearLevel = async (req: AuthRequest, res: Response): Promise<void> => {
  const { code, label, numericLevel, isActive = true, sortOrder = 0 } = req.body;
  const [codeConflict, numericConflict] = await Promise.all([
    YearLevel.findOne({ code: String(code).trim() }),
    YearLevel.findOne({ numericLevel }),
  ]);

  if (codeConflict || numericConflict) {
    throw new AppError('Year level already exists', 409);
  }

  const yearLevel = await YearLevel.create({
    code,
    label,
    numericLevel,
    isActive,
    sortOrder,
  });

  res.status(201).json({
    success: true,
    data: { yearLevel },
  });
};

export const updateYearLevel = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const existingYearLevel = await YearLevel.findById(id);
  if (!existingYearLevel) {
    throw new AppError('Year level not found', 404);
  }

  const nextCode = req.body.code ? String(req.body.code).trim() : existingYearLevel.code;
  const nextNumericLevel =
    typeof req.body.numericLevel === 'number'
      ? req.body.numericLevel
      : existingYearLevel.numericLevel;

  const [codeConflict, numericConflict] = await Promise.all([
    YearLevel.findOne({ _id: { $ne: id }, code: nextCode }),
    YearLevel.findOne({ _id: { $ne: id }, numericLevel: nextNumericLevel }),
  ]);

  if (codeConflict || numericConflict) {
    throw new AppError('Year level already exists', 409);
  }

  const yearLevel = await YearLevel.findByIdAndUpdate(
    id,
    {
      $set: {
        code: req.body.code,
        label: req.body.label,
        numericLevel: req.body.numericLevel,
        isActive: req.body.isActive,
        sortOrder: req.body.sortOrder,
      },
    },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    data: { yearLevel },
  });
};

export const getSections = async (_req: AuthRequest, res: Response): Promise<void> => {
  const sections = await Section.find()
    .populate('programId', 'code name')
    .populate('yearLevelId', 'code label numericLevel')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: { sections },
  });
};

export const createSection = async (req: AuthRequest, res: Response): Promise<void> => {
  const { programId, yearLevelId, name, displayName, isActive = true } = req.body;

  const [program, yearLevel, sectionConflict] = await Promise.all([
    Program.findById(programId),
    YearLevel.findById(yearLevelId),
    Section.findOne({ programId, yearLevelId, name: String(name).trim() }),
  ]);

  if (!program) {
    throw new AppError('Program not found', 404);
  }
  if (!yearLevel) {
    throw new AppError('Year level not found', 404);
  }
  if (sectionConflict) {
    throw new AppError('Section already exists for this program and year level', 409);
  }

  const section = await Section.create({
    programId,
    yearLevelId,
    name,
    displayName,
    isActive,
  });

  const populatedSection = await Section.findById(section._id)
    .populate('programId', 'code name')
    .populate('yearLevelId', 'code label numericLevel');

  res.status(201).json({
    success: true,
    data: { section: populatedSection },
  });
};

export const updateSection = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const existingSection = await Section.findById(id);
  if (!existingSection) {
    throw new AppError('Section not found', 404);
  }

  const nextProgramId = req.body.programId ?? String(existingSection.programId);
  const nextYearLevelId = req.body.yearLevelId ?? String(existingSection.yearLevelId);
  const nextName = req.body.name ? String(req.body.name).trim() : existingSection.name;

  const [program, yearLevel, sectionConflict] = await Promise.all([
    Program.findById(nextProgramId),
    YearLevel.findById(nextYearLevelId),
    Section.findOne({
      _id: { $ne: id },
      programId: nextProgramId,
      yearLevelId: nextYearLevelId,
      name: nextName,
    }),
  ]);

  if (!program) {
    throw new AppError('Program not found', 404);
  }
  if (!yearLevel) {
    throw new AppError('Year level not found', 404);
  }
  if (sectionConflict) {
    throw new AppError('Section already exists for this program and year level', 409);
  }

  const section = await Section.findByIdAndUpdate(
    id,
    {
      $set: {
        programId: req.body.programId,
        yearLevelId: req.body.yearLevelId,
        name: req.body.name,
        displayName: req.body.displayName,
        isActive: req.body.isActive,
      },
    },
    { new: true, runValidators: true }
  )
    .populate('programId', 'code name')
    .populate('yearLevelId', 'code label numericLevel');

  res.status(200).json({
    success: true,
    data: { section },
  });
};
