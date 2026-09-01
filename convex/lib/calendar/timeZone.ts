import { parseDateKey } from "./dateKey.js";

const FALLBACK_TIME_ZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

export function isValidTimeZone(timeZone: string): boolean {
  const trimmed = timeZone.trim();
  if (!trimmed) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(timeZone: string): string {
  const trimmed = timeZone.trim();
  if (!isValidTimeZone(trimmed)) {
    throw new Error("Invalid time zone");
  }
  return trimmed;
}

export function resolveClassTimeZone(timeZone: string | undefined | null): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC";
}

export function timezoneCityLabel(timeZone: string): string {
  return timeZone.replaceAll("_", " ");
}

export function timezoneMatchesQuery(timeZone: string, query: string): boolean {
  const normalize = (value: string) =>
    value.toLowerCase().replaceAll("_", " ").replaceAll("/", " ").replace(/\s+/g, " ").trim();
  const needle = normalize(query);
  if (!needle) return true;
  return normalize(timeZone).includes(needle);
}

export function listIanaTimeZones(): Array<string> {
  const supported = (Intl as { supportedValuesOf?: (key: string) => Array<string> })
    .supportedValuesOf;
  if (typeof supported === "function") {
    try {
      return supported.call(Intl, "timeZone");
    } catch {
      // fall through
    }
  }
  return [...FALLBACK_TIME_ZONES];
}

export function detectBrowserTimeZone(): string | undefined {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timeZone && isValidTimeZone(timeZone) ? timeZone : undefined;
  } catch {
    return undefined;
  }
}

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partsFromFormatter(formatter: Intl.DateTimeFormat, utcMs: number): DateTimeParts {
  const parts = formatter.formatToParts(new Date(utcMs));
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    return Number(value);
  };
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function zonedFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

/** Offset of `timeZone` at `utcMs`: zoned local clock minus UTC. */
export function getTimeZoneOffsetMs(timeZone: string, utcMs: number): number {
  const parts = partsFromFormatter(zonedFormatter(timeZone), utcMs);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - utcMs;
}

export function zonedLocalToUtcMs(
  dateKey: string,
  timeHm: string,
  timeZone: string,
  seconds = 0,
): number {
  const parsed = parseDateKey(dateKey);
  if (!parsed) {
    throw new Error("Invalid date");
  }
  const hour = Number(timeHm.slice(0, 2));
  const minute = Number(timeHm.slice(3, 5));
  const desiredAsUtc = Date.UTC(parsed.year, parsed.month - 1, parsed.day, hour, minute, seconds);
  let utcGuess = desiredAsUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = getTimeZoneOffsetMs(timeZone, utcGuess);
    const next = desiredAsUtc - offset;
    if (next === utcGuess) {
      return next;
    }
    utcGuess = next;
  }
  return utcGuess;
}

export type ZonedDateTimeParts = {
  dateKey: string;
  timeHm: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function utcMsToZonedParts(utcMs: number, timeZone: string): ZonedDateTimeParts {
  const parts = partsFromFormatter(zonedFormatter(timeZone), utcMs);
  const dateKey = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  const timeHm = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
  return {
    dateKey,
    timeHm,
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  };
}

export function startOfZonedDayUtc(dateKey: string, timeZone: string): number {
  return zonedLocalToUtcMs(dateKey, "00:00", timeZone);
}
