import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

export function assertValidDateKey(dateKey: string) {
  if (!DATE_KEY_PATTERN.test(dateKey)) throw new RangeError("Datum mora biti u formatu YYYY-MM-DD.");
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dateKey) {
    throw new RangeError("Unet je neispravan kalendarski datum.");
  }
}

export function assertValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
  } catch {
    throw new RangeError(`Nepoznata vremenska zona: ${timeZone}`);
  }
}

export function localDateTimeToUtc(dateKey: string, time: string, timeZone: string) {
  if (!TIME_PATTERN.test(time)) throw new RangeError(`Neispravno lokalno vreme: ${time}`);
  const [hours, minutes] = time.split(":").map(Number);
  if (hours > 23 || minutes > 59) throw new RangeError(`Neispravno lokalno vreme: ${time}`);
  return fromZonedTime(`${dateKey}T${time}:00`, timeZone);
}

export function getLocalDateKey(instant: Date, timeZone: string) {
  return formatInTimeZone(instant, timeZone, "yyyy-MM-dd");
}

export function weekdayFromDateKey(dateKey: string) {
  // U bazi je ponedeljak 0, dok JavaScript računa nedelju kao 0.
  const sundayBased = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  return (sundayBased + 6) % 7;
}

export function calendarDayDistance(fromDateKey: string, toDateKey: string) {
  const from = new Date(`${fromDateKey}T00:00:00.000Z`).getTime();
  const to = new Date(`${toDateKey}T00:00:00.000Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function toValidDate(value: Date | string, label: string) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError(`${label} nije ispravan datum i vreme.`);
  return date;
}

export function currentTimeMs() {
  return Date.now();
}
