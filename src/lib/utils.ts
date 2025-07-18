import { clsx, type ClassValue } from "clsx";
import { DateTime } from "luxon";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      // Wait before retrying (using exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, delay * Math.pow(2, i)),
      );
    }
  }
  // This return is just to please TypeScript
  throw new Error("Retry attempts exhausted");
}

// utils/formatDateTime.ts
export function formatDateTime(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    ` ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

export function sqlTimestampToLocaleString(sqlTimestamp: string): string {
  // pull user’s locale & timezone from the browser
  const { locale, timeZone } = Intl.DateTimeFormat().resolvedOptions();

  // by annotating `dt` as DateTime, ESLint knows
  // we're not calling an `any` or `unknown` here
  const dt: DateTime = DateTime.fromSQL(sqlTimestamp, { zone: "UTC" }) // parse as UTC
    .setZone(timeZone) // convert to user's tz
    .setLocale(locale); // apply user's locale

  // returns something like "Jul 13, 2025, 3:55:39 AM"
  return dt.toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS);
}

export function tursoDateTime() {
  return DateTime.utc().toFormat("yyyy-MM-dd HH:mm:ss");
}
