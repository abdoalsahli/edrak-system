import { prisma } from "@/lib/prisma";
import { addDays, format, parseISO, isAfter, isBefore, isEqual, addWeeks } from "date-fns";

export type ProposedAppointment = {
  date: string;       // "YYYY-MM-DD"
  startTime: string;  // "HH:mm"
  endTime: string;    // "HH:mm"
  sequenceNumber: number;
};

export type ConflictResult =
  | { ok: true }
  | { ok: false; reason: string };

export type Slot = {
  date: string;
  startTime: string;
  endTime: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 < e2 && e1 > s2;
}

// NOTE: The center operates 24/7 and therapists have no fixed working hours,
// so center-hours, center-holiday and therapist-availability lookups were
// removed from scheduling. Only explicit therapist leave days and real
// double-bookings can block an appointment.

async function getTherapistOverrides(
  therapistId: string,
  fromDate: string,
  toDate: string
): Promise<Map<string, { isAvailable: boolean; start?: string | null; end?: string | null }>> {
  const rows = await prisma.therapistAvailabilityOverride.findMany({
    where: {
      therapistId,
      overrideDate: { gte: new Date(fromDate), lte: new Date(toDate) },
    },
  });
  const map = new Map<string, { isAvailable: boolean; start?: string | null; end?: string | null }>();
  for (const r of rows) {
    map.set(format(new Date(r.overrideDate), "yyyy-MM-dd"), {
      isAvailable: r.isAvailable,
      start: r.startTime,
      end: r.endTime,
    });
  }
  return map;
}

// ─── Core Validation ─────────────────────────────────────────────────────────

export async function validateAvailability(
  therapistId: string,
  patientId: string,
  date: string,
  startTime: string,
  endTime: string,
  exclude?: string | string[] // appointments being moved — they must not conflict with themselves
): Promise<ConflictResult> {
  const excludeIds = exclude ? (Array.isArray(exclude) ? exclude : [exclude]) : [];
  const notExcluded = excludeIds.length ? { id: { notIn: excludeIds } } : {};
  const dow = new Date(date).getDay();

  // The center operates around the clock, every day, and therapists have no
  // fixed working hours — so no operating-hours or availability-window checks.
  // Only real double-bookings are rejected.

  // 1. Explicit therapist leave (vacation / sick day) still blocks booking
  const overrides = await getTherapistOverrides(therapistId, date, date);
  const override = overrides.get(date);
  if (override && !override.isAvailable) {
    return { ok: false, reason: "المعالج في إجازة في هذا التاريخ" };
  }

  // 2. Therapist booking conflict — every booking that day, not just the first one found
  const therapistDay = await prisma.appointment.findMany({
    where: {
      therapistId,
      date: new Date(date),
      status: { not: "CANCELLED" },
      deletedAt: null,
      ...notExcluded,
    },
    select: { startTime: true, endTime: true },
  });
  if (therapistDay.some((a) => timesOverlap(startTime, endTime, a.startTime, a.endTime))) {
    return { ok: false, reason: "المعالج لديه موعد آخر في هذا الوقت" };
  }

  // 3. Patient conflict (cross-program double-booking)
  const patientDay = await prisma.appointment.findMany({
    where: {
      status: { not: "CANCELLED" },
      deletedAt: null,
      date: new Date(date),
      session: { patientId },
      ...notExcluded,
    },
    select: { startTime: true, endTime: true },
  });
  if (patientDay.some((a) => timesOverlap(startTime, endTime, a.startTime, a.endTime))) {
    return { ok: false, reason: "الحالة لديها موعد آخر في هذا الوقت" };
  }

  return { ok: true };
}

// ─── Bulk Program Schedule Generation ───────────────────────────────────────

export async function generateProgramSchedule(config: {
  patientId: string;
  therapistId: string;
  startDate: string;
  totalSessions: number;
  sessionsPerWeek: number;
  durationMin: number;
  defaultStartTime: string;
  allowedDays?: number[]; // 0=Sun … 6=Sat; if empty/undefined → no restriction
  excludeAppointmentIds?: string[]; // appointments being moved (rescheduling a programme)
}): Promise<{ proposed: ProposedAppointment[]; conflicts: string[] }> {
  const { patientId, therapistId, startDate, totalSessions, sessionsPerWeek, durationMin, defaultStartTime, allowedDays, excludeAppointmentIds } = config;

  // Calculate rough end date for override fetching (add buffer)
  const roughWeeks = Math.ceil(totalSessions / sessionsPerWeek) + 8;
  const roughEndDate = format(addWeeks(parseISO(startDate), roughWeeks), "yyyy-MM-dd");
  const overrides = await getTherapistOverrides(therapistId, startDate, roughEndDate);

  const proposed: ProposedAppointment[] = [];
  const conflicts: string[] = [];
  let current = parseISO(startDate);
  let seq = 1;
  let consecutiveMisses = 0;

  while (proposed.length < totalSessions && consecutiveMisses < 365) {
    const dateStr = format(current, "yyyy-MM-dd");
    const dow = current.getDay();
    const override = overrides.get(dateStr);

    // Skip if not in the user-selected days
    if (allowedDays && allowedDays.length > 0 && !allowedDays.includes(dow)) {
      current = addDays(current, 1);
      consecutiveMisses++;
      continue;
    }

    // The center is always open and therapists have no fixed hours —
    // only an explicit leave day blocks scheduling.
    let dayOk = !override || override.isAvailable;

    if (dayOk && proposed.filter((p) => {
      const pDate = parseISO(p.date);
      // count sessions in this week
      const weekStart = format(addDays(current, -dow), "yyyy-MM-dd");
      const weekEnd = format(addDays(current, 6 - dow), "yyyy-MM-dd");
      return p.date >= weekStart && p.date <= weekEnd;
    }).length >= sessionsPerWeek) {
      dayOk = false; // week quota filled
    }

    if (dayOk) {
      const start = defaultStartTime;
      const end = addMinutes(start, durationMin);

      // Check therapist + patient conflicts for this slot
      const conflict = await validateAvailability(therapistId, patientId, dateStr, start, end, excludeAppointmentIds);
      if (conflict.ok) {
        proposed.push({ date: dateStr, startTime: start, endTime: end, sequenceNumber: seq });
        seq++;
        consecutiveMisses = 0;
      } else {
        conflicts.push(`${dateStr}: ${conflict.reason}`);
        consecutiveMisses++;
      }
    } else {
      consecutiveMisses++;
    }

    current = addDays(current, 1);
  }

  return { proposed, conflicts };
}

// ─── Reschedule ───────────────────────────────────────────────────────────────

export async function rescheduleSession(
  sessionId: string,
  newDate: string,
  newStartTime: string,
  durationMin: number,
  scheduledBy: string
): Promise<{ ok: boolean; error?: string; appointmentId?: string }> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      appointments: { where: { status: { not: "CANCELLED" }, deletedAt: null } },
    },
  });
  if (!session) return { ok: false, error: "الجلسة غير موجودة" };
  if (!session.appointments[0]) return { ok: false, error: "لا يوجد موعد نشط لهذه الجلسة" };

  const currentApt = session.appointments[0];
  const newEndTime = addMinutes(newStartTime, durationMin);

  const check = await validateAvailability(
    currentApt.therapistId,
    session.patientId,
    newDate,
    newStartTime,
    newEndTime,
    currentApt.id
  );
  if (!check.ok) return { ok: false, error: check.reason };

  const newApt = await prisma.$transaction(async (tx) => {
    // Cancel old appointment
    await tx.appointment.update({
      where: { id: currentApt.id },
      data: { status: "CANCELLED" },
    });
    // Create new appointment (Scenario A — same session, new slot)
    const apt = await tx.appointment.create({
      data: {
        sessionId,
        therapistId: currentApt.therapistId,
        roomId: currentApt.roomId,
        date: new Date(newDate),
        startTime: newStartTime,
        endTime: newEndTime,
        status: "SCHEDULED",
        isMakeup: false,
        originalAppointmentId: currentApt.id,
        isInsuranceCovered: currentApt.isInsuranceCovered,
        insuranceProviderId: currentApt.insuranceProviderId,
        scheduledBy,
      },
    });
    // Audit
    await tx.sessionAuditLog.create({
      data: {
        sessionId,
        action: "RESCHEDULED",
        previousValue: { date: currentApt.date, startTime: currentApt.startTime },
        newValue: { date: newDate, startTime: newStartTime },
        performedBy: scheduledBy,
      },
    });
    return apt;
  });

  return { ok: true, appointmentId: newApt.id };
}

// ─── Replacement (Scenario B) ─────────────────────────────────────────────────

export async function createReplacementAppointment(
  originalAppointmentId: string,
  newDate: string,
  newStartTime: string,
  durationMin: number,
  scheduledBy: string
): Promise<{ ok: boolean; error?: string }> {
  const original = await prisma.appointment.findUnique({
    where: { id: originalAppointmentId },
    include: { session: true },
  });
  if (!original) return { ok: false, error: "الموعد الأصلي غير موجود" };

  const newEndTime = addMinutes(newStartTime, durationMin);
  const check = await validateAvailability(
    original.therapistId,
    original.session.patientId,
    newDate,
    newStartTime,
    newEndTime
  );
  if (!check.ok) return { ok: false, error: check.reason };

  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({ where: { id: originalAppointmentId }, data: { status: "CANCELLED" } });
    await tx.appointment.create({
      data: {
        sessionId: original.sessionId,
        therapistId: original.therapistId,
        date: new Date(newDate),
        startTime: newStartTime,
        endTime: newEndTime,
        status: "SCHEDULED",
        isMakeup: true,
        originalAppointmentId,
        scheduledBy,
      },
    });
    await tx.sessionAuditLog.create({
      data: {
        sessionId: original.sessionId,
        action: "MAKEUP_CREATED",
        previousValue: { originalAppointmentId },
        newValue: { date: newDate, startTime: newStartTime },
        performedBy: scheduledBy,
      },
    });
  });

  return { ok: true };
}

// ─── Therapist Transfer ───────────────────────────────────────────────────────

export async function transferTherapist(
  programId: string,
  newTherapistId: string,
  effectiveDate: string,
  reason: string | null,
  performedBy: string
): Promise<void> {
  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: {
      sessions: {
        where: { status: "PENDING" },
        include: {
          appointments: { where: { status: "SCHEDULED", deletedAt: null } },
        },
      },
    },
  });
  if (!program) throw new Error("البرنامج غير موجود");

  await prisma.$transaction(async (tx) => {
    // Update future appointments
    for (const session of program.sessions) {
      for (const apt of session.appointments) {
        const aptDate = format(new Date(apt.date), "yyyy-MM-dd");
        if (aptDate >= effectiveDate) {
          await tx.appointment.update({ where: { id: apt.id }, data: { therapistId: newTherapistId } });
        }
      }
    }
    // Update program's current therapist
    await tx.program.update({ where: { id: programId }, data: { therapistId: newTherapistId } });
    // Log the transfer
    await tx.therapistTransferLog.create({
      data: {
        patientId: program.patientId,
        programId,
        fromTherapistId: program.therapistId,
        toTherapistId: newTherapistId,
        transferDate: new Date(effectiveDate),
        reason,
        performedBy,
      },
    });
  });
}
