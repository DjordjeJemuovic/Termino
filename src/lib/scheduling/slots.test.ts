import { describe, expect, it } from "vitest";
import { formatInTimeZone } from "date-fns-tz";
import { getAvailableSlots, type AvailableSlotsInput, type SchedulingStaff } from "./slots";

const timeZone = "Europe/Belgrade";
const serviceId = "service-haircut";

function staff(overrides: Partial<SchedulingStaff> = {}): SchedulingStaff {
  return {
    id: "staff-1",
    active: true,
    serviceIds: [serviceId],
    workingHours: [{ weekday: 0, startTime: "09:00", endTime: "12:00" }],
    appointments: [],
    ...overrides,
  };
}

function input(overrides: Partial<AvailableSlotsInput> = {}): AvailableSlotsInput {
  return {
    date: "2026-10-26", // Ponedeljak u lokalnoj zoni
    timeZone,
    serviceId,
    serviceDurationMinutes: 30,
    bufferMinutes: 0,
    slotStepMinutes: 15,
    minNoticeMinutes: 0,
    maxDaysAhead: 60,
    now: "2026-10-26T06:00:00.000Z", // 07:00 po lokalnom vremenu
    staff: [staff()],
    timeOff: [],
    ...overrides,
  };
}

function localTimes(slots: ReturnType<typeof getAvailableSlots>) {
  return slots.map((slot) => formatInTimeZone(new Date(slot.startsAt), timeZone, "HH:mm"));
}

describe("getAvailableSlots", () => {
  it("podeli smene sa pauzom na zasebne dostupne periode", () => {
    const slots = getAvailableSlots(input({
      staff: [staff({ workingHours: [
        { weekday: 0, startTime: "09:00", endTime: "12:00" },
        { weekday: 0, startTime: "13:00", endTime: "15:00" },
      ] })],
      serviceDurationMinutes: 60,
      slotStepMinutes: 60,
    }));

    expect(localTimes(slots)).toEqual(["09:00", "10:00", "11:00", "13:00", "14:00"]);
  });

  it("ne nudi uslugu koja je duža od slobodnog intervala", () => {
    const slots = getAvailableSlots(input({
      staff: [staff({ workingHours: [{ weekday: 0, startTime: "09:00", endTime: "09:45" }] })],
      serviceDurationMinutes: 60,
    }));

    expect(slots).toEqual([]);
  });

  it("uračunava buffer u zauzeto vreme i u proveru sledećeg termina", () => {
    const slots = getAvailableSlots(input({
      staff: [staff({
        workingHours: [{ weekday: 0, startTime: "09:00", endTime: "12:00" }],
        appointments: [{ startsAt: "2026-10-26T08:00:00.000Z", endsAt: "2026-10-26T09:15:00.000Z", status: "confirmed" }],
      })],
      serviceDurationMinutes: 30,
      bufferMinutes: 15,
    }));

    expect(localTimes(slots)[0]).toBe("10:15");
    expect(localTimes(slots)).not.toContain("11:30");
    expect(slots[0].serviceEndsAt).toBe("2026-10-26T09:45:00.000Z");
    expect(slots[0].blockedUntil).toBe("2026-10-26T10:00:00.000Z");
  });

  it("oduzima odsustvo zaposlenog usred smene", () => {
    const slots = getAvailableSlots(input({
      staff: [staff({ workingHours: [{ weekday: 0, startTime: "09:00", endTime: "12:00" }] })],
      timeOff: [{ staffId: "staff-1", startsAt: "2026-10-26T09:00:00.000Z", endsAt: "2026-10-26T10:00:00.000Z" }],
      serviceDurationMinutes: 30,
      slotStepMinutes: 30,
    }));

    expect(localTimes(slots)).toEqual(["09:00", "09:30", "11:00", "11:30"]);
  });

  it("oduzima odsustvo celog salona od svih zaposlenih", () => {
    const slots = getAvailableSlots(input({
      staff: [staff({ workingHours: [{ weekday: 0, startTime: "09:00", endTime: "12:00" }] })],
      timeOff: [{ staffId: null, startsAt: "2026-10-26T08:00:00.000Z", endsAt: "2026-10-26T09:00:00.000Z" }],
      slotStepMinutes: 30,
    }));

    expect(localTimes(slots)[0]).toBe("10:00");
  });

  it("nudi samo radnike koji rade izabranu uslugu i koji su aktivni", () => {
    const slots = getAvailableSlots(input({
      staff: [
        staff({ id: "inactive", active: false }),
        staff({ id: "not-qualified", serviceIds: ["another-service"] }),
        staff({ id: "qualified", serviceIds: [serviceId] }),
      ],
      staffId: "any",
    }));

    expect(slots[0].availableStaffIds).toEqual(["qualified"]);
  });

  it("spaja iste početke za bilo kog radnika i bira najmanje zauzetog", () => {
    const slots = getAvailableSlots(input({
      staffId: "any",
      staff: [
        staff({ id: "busy", appointments: [
          { startsAt: "2026-10-26T06:00:00.000Z", endsAt: "2026-10-26T06:30:00.000Z", status: "confirmed" },
          { startsAt: "2026-10-26T08:00:00.000Z", endsAt: "2026-10-26T08:30:00.000Z", status: "completed" },
        ] }),
        staff({ id: "light", appointments: [
          { startsAt: "2026-10-26T06:00:00.000Z", endsAt: "2026-10-26T06:30:00.000Z", status: "confirmed" },
        ] }),
      ],
    }));

    expect(slots[0].availableStaffIds).toEqual(["light", "busy"]);
    expect(slots[0].staffId).toBe("light");
    expect(localTimes(slots)[0]).toBe("09:00"); // Završeni termini ne blokiraju dostupnost.
  });

  it("traženi radnik filtrira rezultate", () => {
    const slots = getAvailableSlots(input({
      staffId: "staff-2",
      staff: [staff({ id: "staff-1" }), staff({ id: "staff-2" })],
    }));

    expect(slots.every((slot) => slot.staffId === "staff-2")).toBe(true);
  });

  it("izbacuje termine u prošlosti i one unutar minimalnog roka", () => {
    const slots = getAvailableSlots(input({
      staff: [staff({ workingHours: [{ weekday: 0, startTime: "09:00", endTime: "12:00" }] })],
      now: "2026-10-26T08:20:00.000Z", // 09:20 lokalno
      minNoticeMinutes: 120,
      slotStepMinutes: 15,
    }));

    expect(localTimes(slots)[0]).toBe("11:30");
  });

  it("poštuje maksimalan broj dana za zakazivanje unapred", () => {
    const slots = getAvailableSlots(input({
      date: "2026-10-28",
      now: "2026-10-26T06:00:00.000Z",
      maxDaysAhead: 1,
    }));

    expect(slots).toEqual([]);
  });

  it("za prolećni DST prelaz preskače nepostojeće lokalne sate", () => {
    const slots = getAvailableSlots(input({
      date: "2026-03-29",
      now: "2026-03-29T00:00:00.000Z",
      maxDaysAhead: 365,
      serviceDurationMinutes: 30,
      slotStepMinutes: 30,
      staff: [staff({ workingHours: [{ weekday: 6, startTime: "01:00", endTime: "04:00" }] })],
    }));

    expect(localTimes(slots)).toEqual(["01:00", "01:30", "03:00", "03:30"]);
  });

  it("za jesenji DST prelaz zadržava oba stvarna pojavljivanja ponovljenog sata", () => {
    const slots = getAvailableSlots(input({
      date: "2026-10-25",
      now: "2026-10-24T22:00:00.000Z",
      maxDaysAhead: 365,
      serviceDurationMinutes: 30,
      slotStepMinutes: 30,
      staff: [staff({ workingHours: [{ weekday: 6, startTime: "01:00", endTime: "04:00" }] })],
    }));

    expect(slots).toHaveLength(8);
    expect(localTimes(slots).filter((time) => time === "02:00")).toHaveLength(2);
  });

  it("dozvoljava da usluga završi tačno na kraju smene", () => {
    const slots = getAvailableSlots(input({
      staff: [staff({ workingHours: [{ weekday: 0, startTime: "09:00", endTime: "10:00" }] })],
      serviceDurationMinutes: 60,
    }));

    expect(localTimes(slots)).toEqual(["09:00"]);
  });

  it("odbacuje neispravne intervale radnog vremena", () => {
    expect(() => getAvailableSlots(input({
      staff: [staff({ workingHours: [{ weekday: 0, startTime: "12:00", endTime: "09:00" }] })],
    }))).toThrow(RangeError);
  });

  it("odbacuje preklapajuće smene istog zaposlenog pre računanja", () => {
    expect(() => getAvailableSlots(input({
      staff: [staff({ workingHours: [
        { weekday: 0, startTime: "09:00", endTime: "11:00" },
        { weekday: 0, startTime: "10:00", endTime: "12:00" },
      ] })],
    }))).toThrow(RangeError);
  });
});
