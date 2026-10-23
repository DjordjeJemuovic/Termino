import {
  assertValidDateKey,
  assertValidTimeZone,
  calendarDayDistance,
  getLocalDateKey,
  localDateTimeToUtc,
  toValidDate,
  weekdayFromDateKey,
} from "./time";
import { orderStaffByLoad } from "./assign-staff";

export type LocalWorkingInterval = {
  weekday?: number;
  startTime: string;
  endTime: string;
};

export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

export type BusyAppointment = {
  startsAt: Date | string;
  endsAt: Date | string;
  status: AppointmentStatus;
};

export type TimeOff = {
  staffId: string | null;
  startsAt: Date | string;
  endsAt: Date | string;
};

export type SchedulingStaff = {
  id: string;
  active: boolean;
  serviceIds: string[];
  workingHours: LocalWorkingInterval[];
  appointments: BusyAppointment[];
};

export type AvailableSlot = {
  startsAt: string;
  serviceEndsAt: string;
  blockedUntil: string;
  staffId: string;
  availableStaffIds: string[];
};

export type AvailableSlotsInput = {
  date: string;
  timeZone: string;
  serviceId: string;
  serviceDurationMinutes: number;
  bufferMinutes: number;
  slotStepMinutes: number;
  minNoticeMinutes: number;
  maxDaysAhead: number;
  now: Date | string;
  staffId?: string | "any";
  staff: SchedulingStaff[];
  timeOff: TimeOff[];
};

type Range = { start: number; end: number };

/**
 * Čista funkcija za dnevnu dostupnost: svi podaci dolaze kroz ulaz, bez baze ili IO poziva.
 * Radno vreme se tumači u lokalnoj zoni salona; termini i odsustva su apsolutni UTC trenuci.
 */
export function getAvailableSlots(input: AvailableSlotsInput): AvailableSlot[] {
  validateInput(input);

  const now = toValidDate(input.now, "Trenutno vreme");
  const localToday = getLocalDateKey(now, input.timeZone);
  const daysAhead = calendarDayDistance(localToday, input.date);
  if (daysAhead < 0 || daysAhead > input.maxDaysAhead) return [];

  const weekday = weekdayFromDateKey(input.date);
  const serviceBlockMinutes = input.serviceDurationMinutes + input.bufferMinutes;
  const stepMilliseconds = input.slotStepMinutes * 60_000;
  const serviceMilliseconds = input.serviceDurationMinutes * 60_000;
  const blockMilliseconds = serviceBlockMinutes * 60_000;
  const dayStart = localDateTimeToUtc(input.date, "00:00", input.timeZone).getTime();
  const earliestStart = now.getTime() + input.minNoticeMinutes * 60_000;
  const candidateStaff = input.staff.filter((person) =>
    person.active &&
    person.serviceIds.includes(input.serviceId) &&
    (input.staffId === undefined || input.staffId === "any" || person.id === input.staffId),
  );

  const slotsByStart = new Map<string, Array<{ staffId: string; appointmentCount: number }>>();

  for (const person of candidateStaff) {
    const workingRanges = person.workingHours
      .filter((interval) => interval.weekday === undefined || interval.weekday === weekday)
      .map((interval) => ({
        start: localDateTimeToUtc(input.date, interval.startTime, input.timeZone).getTime(),
        end: localDateTimeToUtc(input.date, interval.endTime, input.timeZone).getTime(),
      }))
      .filter((range) => range.start < range.end);

    const busyRanges = [
      ...person.appointments
        .filter((appointment) => appointment.status === "pending" || appointment.status === "confirmed")
        .map((appointment) => ({
          start: toValidDate(appointment.startsAt, "Početak termina").getTime(),
          end: toValidDate(appointment.endsAt, "Kraj termina").getTime(),
        })),
      ...input.timeOff
        .filter((absence) => absence.staffId === null || absence.staffId === person.id)
        .map((absence) => ({
          start: toValidDate(absence.startsAt, "Početak odsustva").getTime(),
          end: toValidDate(absence.endsAt, "Kraj odsustva").getTime(),
        })),
    ].filter((range) => range.start < range.end);

    const freeRanges = subtractRanges(mergeRanges(workingRanges), busyRanges);
    const appointmentCount = person.appointments.filter((appointment) =>
      appointment.status !== "cancelled" &&
      getLocalDateKey(toValidDate(appointment.startsAt, "Početak termina"), input.timeZone) === input.date,
    ).length;

    for (const freeRange of freeRanges) {
      let start = alignToStep(freeRange.start, dayStart, stepMilliseconds);
      while (start + blockMilliseconds <= freeRange.end) {
        if (start >= earliestStart) {
          const startIso = new Date(start).toISOString();
          const available = slotsByStart.get(startIso) ?? [];
          available.push({ staffId: person.id, appointmentCount });
          slotsByStart.set(startIso, available);
        }
        start += stepMilliseconds;
      }
    }
  }

  return [...slotsByStart.entries()]
    .sort(([startA], [startB]) => startA.localeCompare(startB))
    .map(([startsAt, staff]) => {
      const orderedStaff = orderStaffByLoad(staff);
      const start = new Date(startsAt).getTime();
      return {
        startsAt,
        serviceEndsAt: new Date(start + serviceMilliseconds).toISOString(),
        blockedUntil: new Date(start + blockMilliseconds).toISOString(),
        staffId: orderedStaff[0].staffId,
        availableStaffIds: orderedStaff.map((person) => person.staffId),
      };
    });
}

function validateInput(input: AvailableSlotsInput) {
  assertValidDateKey(input.date);
  assertValidTimeZone(input.timeZone);

  for (const [name, value, allowZero] of [
    ["Trajanje usluge", input.serviceDurationMinutes, false],
    ["Buffer usluge", input.bufferMinutes, true],
    ["Korak termina", input.slotStepMinutes, false],
    ["Minimalno vreme unapred", input.minNoticeMinutes, true],
    ["Maksimalan broj dana unapred", input.maxDaysAhead, true],
  ] as const) {
    if (!Number.isInteger(value) || value < (allowZero ? 0 : 1)) {
      throw new RangeError(`${name} mora biti ceo broj ${allowZero ? "veći ili jednak 0" : "veći od 0"}.`);
    }
  }

  // Proverimo sada da je ulazno vreme ispravno čak i kada nema zaposlenih.
  toValidDate(input.now, "Trenutno vreme");

  const targetWeekday = weekdayFromDateKey(input.date);
  for (const person of input.staff) {
    const intervalsByDay = new Map<number, LocalWorkingInterval[]>();
    for (const interval of person.workingHours) {
      const weekday = interval.weekday ?? targetWeekday;
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
        throw new RangeError("Dan radnog vremena mora biti između 0 (ponedeljak) i 6 (nedelja).");
      }
      if (interval.startTime >= interval.endTime) {
        throw new RangeError("Kraj radnog intervala mora biti posle početka.");
      }
      localDateTimeToUtc(input.date, interval.startTime, input.timeZone);
      localDateTimeToUtc(input.date, interval.endTime, input.timeZone);
      const dayIntervals = intervalsByDay.get(weekday) ?? [];
      dayIntervals.push(interval);
      intervalsByDay.set(weekday, dayIntervals);
    }

    for (const [weekday, dayIntervals] of intervalsByDay) {
      const sorted = [...dayIntervals].sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (let index = 1; index < sorted.length; index += 1) {
        if (sorted[index].startTime < sorted[index - 1].endTime) {
          throw new RangeError("Radni intervali istog dana ne mogu da se preklapaju.");
        }
      }

      // DST može da učini lokalni interval nepostojećim ili obrnutim tog dana.
      if (weekday === targetWeekday) {
        for (const interval of sorted) {
          const start = localDateTimeToUtc(input.date, interval.startTime, input.timeZone).getTime();
          const end = localDateTimeToUtc(input.date, interval.endTime, input.timeZone).getTime();
          if (start >= end) throw new RangeError("Radni interval nije važeći zbog promene vremenske zone.");
        }
      }
    }
  }
}

function alignToStep(instant: number, gridStart: number, step: number) {
  const stepsFromStart = Math.ceil((instant - gridStart) / step);
  return gridStart + stepsFromStart * step;
}

/** Oduzima spojene zauzete intervale iz smena; granice su [početak, kraj). */
function subtractRanges(working: Range[], busy: Range[]) {
  const mergedBusy = mergeRanges(busy);
  const free: Range[] = [];

  for (const shift of working) {
    let cursor = shift.start;
    for (const block of mergedBusy) {
      if (block.end <= cursor) continue;
      if (block.start >= shift.end) break;
      if (block.start > cursor) free.push({ start: cursor, end: Math.min(block.start, shift.end) });
      cursor = Math.max(cursor, block.end);
      if (cursor >= shift.end) break;
    }
    if (cursor < shift.end) free.push({ start: cursor, end: shift.end });
  }

  return free;
}

function mergeRanges(ranges: Range[]) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Range[] = [];

  for (const range of sorted) {
    const last = merged.at(-1);
    if (!last || range.start > last.end) merged.push({ ...range });
    else last.end = Math.max(last.end, range.end);
  }

  return merged;
}
