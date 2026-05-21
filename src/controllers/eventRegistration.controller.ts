import { Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Event from '../models/Event';
import EventRegistration from '../models/EventRegistration';
import EventAttendanceLog from '../models/EventAttendanceLog';
import Student from '../models/Student';
import ActivityLog from '../models/ActivityLog';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { StudentAuthRequest } from '../middleware/studentAuth';
import {
  AttendanceScanResult,
  EventRegistrationStatus,
  EventStatus,
  Permission,
} from '../types';
import { ensureCanManageOwnedContent } from '../utils/organizationScope';

const getStudentQrSecret = (): string => {
  const secret =
    process.env.STUDENT_QR_SECRET ||
    process.env.STUDENT_JWT_SECRET ||
    process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('Student QR secret is not configured');
  }

  return secret;
};

const createQrNonce = (): string => crypto.randomBytes(16).toString('hex');

const buildQrToken = (payload: Record<string, unknown>): string =>
  jwt.sign(payload, getStudentQrSecret(), {
    expiresIn: process.env.STUDENT_QR_EXPIRE || '7d',
  } as jwt.SignOptions);

const isStudentEligibleForEvent = (
  event: {
    targetProgramIds?: string[];
    targetYearLevelIds?: string[];
    targetSectionIds?: string[];
  },
  student: {
    programId: unknown;
    yearLevelId: unknown;
    sectionId: unknown;
  }
): boolean => {
  const programId = String(student.programId);
  const yearLevelId = String(student.yearLevelId);
  const sectionId = String(student.sectionId);

  const matchesPrograms =
    !event.targetProgramIds || event.targetProgramIds.length === 0 || event.targetProgramIds.includes(programId);
  const matchesYearLevels =
    !event.targetYearLevelIds ||
    event.targetYearLevelIds.length === 0 ||
    event.targetYearLevelIds.includes(yearLevelId);
  const matchesSections =
    !event.targetSectionIds ||
    event.targetSectionIds.length === 0 ||
    event.targetSectionIds.includes(sectionId);

  return matchesPrograms && matchesYearLevels && matchesSections;
};

const ensureEventOpenForRegistration = (event: {
  status: EventStatus;
  isRegistrationOpen: boolean;
  registrationCloseAt?: Date;
}) => {
  if (event.status !== EventStatus.PUBLISHED) {
    throw new AppError('Event is not open for registration', 400);
  }

  if (!event.isRegistrationOpen) {
    throw new AppError('Event registration is closed', 400);
  }

  if (event.registrationCloseAt && event.registrationCloseAt < new Date()) {
    throw new AppError('Event registration has already closed', 400);
  }
};

const logStudentActivity = async (input: {
  action: string;
  resource: string;
  resourceId?: string;
  studentId?: string;
  eventId?: string;
  outcome?: 'success' | 'failure' | 'denied' | 'duplicate';
  reasonCode?: string;
  details?: Record<string, unknown>;
}) => {
  await ActivityLog.create({
    actorType: 'student',
    actorId: input.studentId,
    studentId: input.studentId,
    eventId: input.eventId,
    action: input.action,
    resource: input.resource,
    resourceId: input.resourceId,
    outcome: input.outcome,
    reasonCode: input.reasonCode,
    details: input.details,
    severity: input.outcome === 'failure' || input.outcome === 'denied' ? 'warn' : 'info',
  });
};

const logAdminAttendanceActivity = async (input: {
  adminUserId: string;
  action: string;
  eventId: string;
  resourceId?: string;
  outcome: 'success' | 'failure' | 'denied' | 'duplicate';
  studentId?: string;
  reasonCode?: string;
  details?: Record<string, unknown>;
}) => {
  await ActivityLog.create({
    user: input.adminUserId,
    actorType: 'admin',
    actorId: input.adminUserId,
    action: input.action,
    resource: 'event_attendance',
    resourceId: input.resourceId,
    eventId: input.eventId,
    studentId: input.studentId,
    outcome: input.outcome,
    reasonCode: input.reasonCode,
    details: input.details,
    severity: input.outcome === 'success' ? 'info' : 'warn',
  });
};

const incrementCheckedInCount = async (eventId: string) => {
  await Event.findByIdAndUpdate(eventId, { $inc: { checkedInCount: 1 } });
};

export const getStudentEvents = async (req: StudentAuthRequest, res: Response): Promise<void> => {
  if (!req.student) {
    throw new AppError('Student not authenticated', 401);
  }

  const events = await Event.find({
    status: EventStatus.PUBLISHED,
    endDate: { $gte: new Date() },
  }).sort({ startDate: 1 });

  const eligibleEvents = events.filter((event) => isStudentEligibleForEvent(event, req.student!));
  const registrations = await EventRegistration.find({
    studentId: req.student.studentId,
    eventId: { $in: eligibleEvents.map((event) => event._id) },
  });

  const registrationMap = new Map(
    registrations.map((registration) => [String(registration.eventId), registration])
  );

  res.status(200).json({
    success: true,
    data: {
      events: eligibleEvents.map((event) => ({
        ...event.toObject(),
        registration: registrationMap.get(String(event._id)) ?? null,
      })),
    },
  });
};

export const registerForEvent = async (
  req: StudentAuthRequest,
  res: Response
): Promise<void> => {
  if (!req.student) {
    throw new AppError('Student not authenticated', 401);
  }

  const event = await Event.findById(req.params.id);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  ensureEventOpenForRegistration(event);

  const student = await Student.findById(req.student.studentId);
  if (!student) {
    throw new AppError('Student not found', 404);
  }

  if (!isStudentEligibleForEvent(event, student)) {
    throw new AppError('Student is not eligible for this event', 403);
  }

  const existingRegistration = await EventRegistration.findOne({
    eventId: event._id,
    studentId: student._id,
    status: { $in: [EventRegistrationStatus.REGISTERED, EventRegistrationStatus.CHECKED_IN] },
  });

  if (existingRegistration) {
    throw new AppError('Student is already registered for this event', 409);
  }

  const capacityUpdate =
    event.maxAttendees && event.maxAttendees > 0
      ? await Event.findOneAndUpdate(
          { _id: event._id, registeredCount: { $lt: event.maxAttendees } },
          { $inc: { registeredCount: 1 } },
          { new: true }
        )
      : await Event.findByIdAndUpdate(event._id, { $inc: { registeredCount: 1 } }, { new: true });

  if (!capacityUpdate) {
    throw new AppError('Event is already full', 409);
  }

  try {
    const registration = await EventRegistration.create({
      eventId: event._id,
      studentId: student._id,
      status: EventRegistrationStatus.REGISTERED,
      qrNonce: createQrNonce(),
      qrIssuedAt: new Date(),
      registeredAt: new Date(),
      eligibilitySnapshot: {
        programId: String(student.programId),
        yearLevelId: String(student.yearLevelId),
        sectionId: String(student.sectionId),
      },
      source: 'self',
    });

    await logStudentActivity({
      action: 'student_register_event',
      resource: 'event_registration',
      resourceId: String(registration._id),
      studentId: String(student._id),
      eventId: String(event._id),
      outcome: 'success',
    });

    res.status(201).json({
      success: true,
      data: { registration },
    });
  } catch (error) {
    await Event.findByIdAndUpdate(event._id, { $inc: { registeredCount: -1 } });
    throw error;
  }
};

export const cancelEventRegistration = async (
  req: StudentAuthRequest,
  res: Response
): Promise<void> => {
  if (!req.student) {
    throw new AppError('Student not authenticated', 401);
  }

  const registration = await EventRegistration.findOne({
    eventId: req.params.id,
    studentId: req.student.studentId,
    status: { $in: [EventRegistrationStatus.REGISTERED] },
  });

  if (!registration) {
    throw new AppError('Active registration not found', 404);
  }

  registration.status = EventRegistrationStatus.CANCELLED;
  registration.cancelledAt = new Date();
  await registration.save();

  await Event.findByIdAndUpdate(req.params.id, { $inc: { registeredCount: -1 } });

  await logStudentActivity({
    action: 'student_cancel_event_registration',
    resource: 'event_registration',
    resourceId: String(registration._id),
    studentId: req.student.studentId,
    eventId: req.params.id,
    outcome: 'success',
  });

  res.status(200).json({
    success: true,
    data: { registration },
  });
};

export const getOwnEventRegistration = async (
  req: StudentAuthRequest,
  res: Response
): Promise<void> => {
  if (!req.student) {
    throw new AppError('Student not authenticated', 401);
  }

  const registration = await EventRegistration.findOne({
    eventId: req.params.id,
    studentId: req.student.studentId,
  });

  res.status(200).json({
    success: true,
    data: { registration },
  });
};

export const getStudentRegistrations = async (
  req: StudentAuthRequest,
  res: Response
): Promise<void> => {
  if (!req.student) {
    throw new AppError('Student not authenticated', 401);
  }

  const registrations = await EventRegistration.find({
    studentId: req.student.studentId,
  })
    .populate('eventId', 'title startDate endDate location status')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: { registrations },
  });
};

export const getEventQrPayload = async (
  req: StudentAuthRequest,
  res: Response
): Promise<void> => {
  if (!req.student) {
    throw new AppError('Student not authenticated', 401);
  }

  const registration = await EventRegistration.findOne({
    eventId: req.params.id,
    studentId: req.student.studentId,
    status: { $in: [EventRegistrationStatus.REGISTERED, EventRegistrationStatus.CHECKED_IN] },
  });

  if (!registration) {
    throw new AppError('Active registration not found', 404);
  }

  const token = buildQrToken({
    actorType: 'student_qr',
    eventId: req.params.id,
    registrationId: String(registration._id),
    studentId: req.student.studentId,
    studentNumber: req.student.studentNumber,
    qrVersion: req.student.qrVersion,
    qrNonce: registration.qrNonce,
  });

  await logStudentActivity({
    action: 'student_generate_event_qr',
    resource: 'student_qr',
    resourceId: String(registration._id),
    studentId: req.student.studentId,
    eventId: req.params.id,
    outcome: 'success',
  });

  res.status(200).json({
    success: true,
    data: {
      token,
      registrationId: String(registration._id),
    },
  });
};

export const getStudentAttendanceHistory = async (
  req: StudentAuthRequest,
  res: Response
): Promise<void> => {
  if (!req.student) {
    throw new AppError('Student not authenticated', 401);
  }

  const attendanceLogs = await EventAttendanceLog.find({
    studentId: req.student.studentId,
  })
    .populate('eventId', 'title startDate location')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: { attendanceLogs },
  });
};

export const getEventRegistrationsForAdmin = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  await ensureCanManageOwnedContent(
    req.user,
    Permission.VIEW_EVENT_REGISTRATIONS,
    event.ownerType,
    event.organizationId ?? null
  );

  const registrations = await EventRegistration.find({ eventId: event._id })
    .populate('studentId', 'studentNumber firstName lastName email status')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: { registrations },
  });
};

export const scanEventAttendance = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  await ensureCanManageOwnedContent(
    req.user,
    Permission.SCAN_EVENT_ATTENDANCE,
    event.ownerType,
    event.organizationId ?? null
  );

  const { qrToken, studentNumber, notes } = req.body as {
    qrToken?: string;
    studentNumber?: string;
    notes?: string;
  };

  let registration: any = null;
  let student: any = null;

  if (qrToken) {
    try {
      const decoded = jwt.verify(qrToken, getStudentQrSecret()) as Record<string, unknown>;
      if (decoded.actorType !== 'student_qr' || decoded.eventId !== req.params.id) {
        throw new Error('QR token does not match event');
      }

      registration = await EventRegistration.findById(String(decoded.registrationId));
      if (!registration) {
        throw new Error('Registration not found');
      }
      student = await Student.findById(String(decoded.studentId));
      if (!student) {
        throw new Error('Student not found');
      }
      if (registration.qrNonce !== decoded.qrNonce) {
        throw new Error('QR nonce mismatch');
      }
      if (student.qrVersion !== decoded.qrVersion) {
        throw new Error('QR version mismatch');
      }
    } catch {
      await EventAttendanceLog.create({
        eventId: event._id,
        scanType: 'entry',
        result: AttendanceScanResult.INVALID_QR,
        scannedByAdminId: req.user?.userId,
        notes,
      });

      await logAdminAttendanceActivity({
        adminUserId: req.user!.userId,
        action: 'scan_event_attendance',
        eventId: req.params.id,
        outcome: 'failure',
        reasonCode: AttendanceScanResult.INVALID_QR,
      });

      res.status(200).json({
        success: true,
        data: { result: AttendanceScanResult.INVALID_QR },
      });
      return;
    }
  } else if (studentNumber) {
    student = await Student.findOne({ studentNumber: studentNumber.trim().toUpperCase() });
    if (!student) {
      res.status(200).json({
        success: true,
        data: { result: AttendanceScanResult.NOT_REGISTERED },
      });
      return;
    }

    registration = await EventRegistration.findOne({
      eventId: event._id,
      studentId: student._id,
      status: { $in: [EventRegistrationStatus.REGISTERED, EventRegistrationStatus.CHECKED_IN] },
    });

    if (!registration && event.allowWalkIns) {
      try {
        ensureEventOpenForRegistration(event);
      } catch {
        res.status(200).json({
          success: true,
          data: { result: AttendanceScanResult.REGISTRATION_CLOSED },
        });
        return;
      }

      if (!isStudentEligibleForEvent(event, student)) {
        res.status(200).json({
          success: true,
          data: { result: AttendanceScanResult.NOT_ELIGIBLE },
        });
        return;
      }

      const capacityUpdate =
        event.maxAttendees && event.maxAttendees > 0
          ? await Event.findOneAndUpdate(
              { _id: event._id, registeredCount: { $lt: event.maxAttendees } },
              { $inc: { registeredCount: 1 } },
              { new: true }
            )
          : await Event.findByIdAndUpdate(event._id, { $inc: { registeredCount: 1 } }, { new: true });

      if (!capacityUpdate) {
        res.status(200).json({
          success: true,
          data: { result: AttendanceScanResult.EVENT_FULL },
        });
        return;
      }

      registration = await EventRegistration.create({
        eventId: event._id,
        studentId: student._id,
        status: EventRegistrationStatus.REGISTERED,
        qrNonce: createQrNonce(),
        qrIssuedAt: new Date(),
        registeredAt: new Date(),
        eligibilitySnapshot: {
          programId: String(student.programId),
          yearLevelId: String(student.yearLevelId),
          sectionId: String(student.sectionId),
        },
        source: 'walk_in',
      });
    }
  }

  if (!registration || !student) {
    await EventAttendanceLog.create({
      eventId: event._id,
      scanType: qrToken ? 'entry' : 'manual',
      result: AttendanceScanResult.NOT_REGISTERED,
      scannedByAdminId: req.user?.userId,
      notes,
    });

    await logAdminAttendanceActivity({
      adminUserId: req.user!.userId,
      action: 'scan_event_attendance',
      eventId: req.params.id,
      outcome: 'failure',
      reasonCode: AttendanceScanResult.NOT_REGISTERED,
    });

    res.status(200).json({
      success: true,
      data: { result: AttendanceScanResult.NOT_REGISTERED },
    });
    return;
  }

  if (registration.status === EventRegistrationStatus.CANCELLED) {
    res.status(200).json({
      success: true,
      data: { result: AttendanceScanResult.NOT_REGISTERED },
    });
    return;
  }

  if (!isStudentEligibleForEvent(event, student)) {
    res.status(200).json({
      success: true,
      data: { result: AttendanceScanResult.NOT_ELIGIBLE },
    });
    return;
  }

  if (registration.checkedInAt) {
    await EventAttendanceLog.create({
      eventId: event._id,
      registrationId: registration._id,
      studentId: student._id,
      scanType: qrToken ? 'entry' : 'manual',
      result: AttendanceScanResult.DUPLICATE,
      scannedByAdminId: req.user?.userId,
      notes,
    });

    await logAdminAttendanceActivity({
      adminUserId: req.user!.userId,
      action: 'scan_event_attendance',
      eventId: req.params.id,
      resourceId: String(registration._id),
      outcome: 'duplicate',
      studentId: String(student._id),
      reasonCode: AttendanceScanResult.DUPLICATE,
    });

    res.status(200).json({
      success: true,
      data: { result: AttendanceScanResult.DUPLICATE, registration },
    });
    return;
  }

  registration.checkedInAt = new Date();
  registration.scanCount += 1;
  registration.status = EventRegistrationStatus.CHECKED_IN;
  await registration.save();
  await incrementCheckedInCount(req.params.id);

  await EventAttendanceLog.create({
    eventId: event._id,
    registrationId: registration._id,
    studentId: student._id,
    scanType: qrToken ? 'entry' : 'manual',
    result: AttendanceScanResult.SUCCESS,
    scannedByAdminId: req.user?.userId,
    notes,
  });

  await logAdminAttendanceActivity({
    adminUserId: req.user!.userId,
    action: 'scan_event_attendance',
    eventId: req.params.id,
    resourceId: String(registration._id),
    outcome: 'success',
    studentId: String(student._id),
    reasonCode: AttendanceScanResult.SUCCESS,
  });

  res.status(200).json({
    success: true,
    data: { result: AttendanceScanResult.SUCCESS, registration },
  });
};

export const adminCancelRegistration = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { id: eventId, regId } = req.params;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  await ensureCanManageOwnedContent(
    req.user,
    Permission.MANAGE_EVENT_REGISTRATIONS,
    event.ownerType,
    event.organizationId ?? null
  );

  const registration = await EventRegistration.findById(regId);
  if (!registration) {
    throw new AppError('Registration not found', 404);
  }

  if (registration.eventId.toString() !== eventId) {
    throw new AppError('Registration does not belong to this event', 400);
  }

  if (registration.status === EventRegistrationStatus.CANCELLED) {
    throw new AppError('Registration is already cancelled', 400);
  }

  const wasCheckedIn = registration.status === EventRegistrationStatus.CHECKED_IN;

  registration.status = EventRegistrationStatus.CANCELLED;
  registration.cancelledAt = new Date();
  await registration.save();

  if (!wasCheckedIn) {
    await Event.findOneAndUpdate(
      { _id: eventId, registeredCount: { $gt: 0 } },
      { $inc: { registeredCount: -1 } }
    );
  } else {
    // Also decrement registeredCount when cancelling a checked-in registration
    await Event.findOneAndUpdate(
      { _id: eventId, registeredCount: { $gt: 0 } },
      { $inc: { registeredCount: -1 } }
    );
    await Event.findOneAndUpdate(
      { _id: eventId, checkedInCount: { $gt: 0 } },
      { $inc: { checkedInCount: -1 } }
    );
  }

  await logAdminAttendanceActivity({
    adminUserId: req.user!.userId,
    action: 'admin_cancel_registration',
    eventId,
    resourceId: regId,
    outcome: 'success',
    studentId: String(registration.studentId),
  });

  res.status(200).json({
    success: true,
    data: { registration },
  });
};

export const adminUpdateRegistrationStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { id: eventId, regId } = req.params;
  const { status } = req.body as { status?: string };

  if (!status || !Object.values(EventRegistrationStatus).includes(status as EventRegistrationStatus)) {
    throw new AppError('Valid status is required', 400);
  }

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  await ensureCanManageOwnedContent(
    req.user,
    Permission.MANAGE_EVENT_REGISTRATIONS,
    event.ownerType,
    event.organizationId ?? null
  );

  const registration = await EventRegistration.findById(regId);
  if (!registration) {
    throw new AppError('Registration not found', 404);
  }

  if (registration.eventId.toString() !== eventId) {
    throw new AppError('Registration does not belong to this event', 400);
  }

  const prevStatus = registration.status;
  registration.status = status as EventRegistrationStatus;

  // Transitioning away from CHECKED_IN — decrement checkedInCount
  if (prevStatus === EventRegistrationStatus.CHECKED_IN && status !== EventRegistrationStatus.CHECKED_IN) {
    await Event.findOneAndUpdate(
      { _id: eventId, checkedInCount: { $gt: 0 } },
      { $inc: { checkedInCount: -1 } }
    );
  }

  if (status === EventRegistrationStatus.CANCELLED && !registration.cancelledAt) {
    registration.cancelledAt = new Date();
    if (prevStatus !== EventRegistrationStatus.CHECKED_IN) {
      await Event.findOneAndUpdate(
        { _id: eventId, registeredCount: { $gt: 0 } },
        { $inc: { registeredCount: -1 } }
      );
    } else {
      // Also decrement registeredCount when cancelling a checked-in registration
      await Event.findOneAndUpdate(
        { _id: eventId, registeredCount: { $gt: 0 } },
        { $inc: { registeredCount: -1 } }
      );
    }
  }

  if (status === EventRegistrationStatus.REGISTERED && prevStatus === EventRegistrationStatus.CANCELLED) {
    await Event.findByIdAndUpdate(eventId, { $inc: { registeredCount: 1 } });
    registration.cancelledAt = undefined;
  }

  if (status === EventRegistrationStatus.CHECKED_IN && !registration.checkedInAt) {
    registration.checkedInAt = new Date();
    registration.scanCount += 1;
    await incrementCheckedInCount(eventId);
  }

  await registration.save();

  await logAdminAttendanceActivity({
    adminUserId: req.user!.userId,
    action: 'admin_update_registration_status',
    eventId,
    resourceId: regId,
    outcome: 'success',
    studentId: String(registration.studentId),
  });

  res.status(200).json({
    success: true,
    data: { registration },
  });
};

export const adminCreateRegistration = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  await ensureCanManageOwnedContent(
    req.user,
    Permission.MANAGE_EVENT_REGISTRATIONS,
    event.ownerType,
    event.organizationId ?? null
  );

  const { studentNumber } = req.body as { studentNumber?: string };
  if (!studentNumber) {
    throw new AppError('Student number is required', 400);
  }

  const student = await Student.findOne({ studentNumber: studentNumber.trim().toUpperCase() });
  if (!student) {
    throw new AppError('Student not found', 404);
  }

  if (!isStudentEligibleForEvent(event, student)) {
    throw new AppError('Student is not eligible for this event', 403);
  }

  const existingRegistration = await EventRegistration.findOne({
    eventId: event._id,
    studentId: student._id,
    status: { $in: [EventRegistrationStatus.REGISTERED, EventRegistrationStatus.CHECKED_IN] },
  });

  if (existingRegistration) {
    throw new AppError('Student is already registered for this event', 409);
  }

  const capacityUpdate =
    event.maxAttendees && event.maxAttendees > 0
      ? await Event.findOneAndUpdate(
          { _id: event._id, registeredCount: { $lt: event.maxAttendees } },
          { $inc: { registeredCount: 1 } },
          { new: true }
        )
      : await Event.findByIdAndUpdate(event._id, { $inc: { registeredCount: 1 } }, { new: true });

  if (!capacityUpdate) {
    throw new AppError('Event is already full', 409);
  }

  const registration = await EventRegistration.create({
    eventId: event._id,
    studentId: student._id,
    status: EventRegistrationStatus.REGISTERED,
    qrNonce: createQrNonce(),
    qrIssuedAt: new Date(),
    registeredAt: new Date(),
    eligibilitySnapshot: {
      programId: String(student.programId),
      yearLevelId: String(student.yearLevelId),
      sectionId: String(student.sectionId),
    },
    source: 'admin',
  });

  await logAdminAttendanceActivity({
    adminUserId: req.user!.userId,
    action: 'admin_create_registration',
    eventId: String(event._id),
    resourceId: String(registration._id),
    outcome: 'success',
    studentId: String(student._id),
  });

  res.status(201).json({
    success: true,
    data: { registration },
  });
};

export const adminUndoCheckIn = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { id: eventId, regId } = req.params;

  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  await ensureCanManageOwnedContent(
    req.user,
    Permission.MANAGE_EVENT_REGISTRATIONS,
    event.ownerType,
    event.organizationId ?? null
  );

  const registration = await EventRegistration.findById(regId);
  if (!registration) {
    throw new AppError('Registration not found', 404);
  }

  if (registration.eventId.toString() !== eventId) {
    throw new AppError('Registration does not belong to this event', 400);
  }

  if (registration.status !== EventRegistrationStatus.CHECKED_IN) {
    throw new AppError('Registration is not checked in', 400);
  }

  registration.status = EventRegistrationStatus.REGISTERED;
  registration.checkedInAt = undefined;
  registration.scanCount = Math.max(0, (registration.scanCount || 1) - 1);
  await registration.save();

  await Event.findOneAndUpdate(
    { _id: eventId, checkedInCount: { $gt: 0 } },
    { $inc: { checkedInCount: -1 } }
  );

  await logAdminAttendanceActivity({
    adminUserId: req.user!.userId,
    action: 'admin_undo_check_in',
    eventId,
    resourceId: regId,
    outcome: 'success',
    studentId: String(registration.studentId),
  });

  res.status(200).json({
    success: true,
    data: { registration },
  });
};
