export const REMINDER_UNITS = ["minute", "hour", "day", "week"] as const;
export type ReminderUnit = (typeof REMINDER_UNITS)[number];

export const MAX_REMINDERS_PER_EVENT = 8;
export const MAX_REMINDER_AMOUNT = 99;

const UNIT_MS: Record<ReminderUnit, number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 7 * 86_400_000,
};

export function isReminderUnit(value: string): value is ReminderUnit {
  return (REMINDER_UNITS as ReadonlyArray<string>).includes(value);
}

export function reminderOffsetMs(amount: number, unit: ReminderUnit): number {
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_REMINDER_AMOUNT) {
    throw new Error("Invalid reminder amount");
  }
  return amount * UNIT_MS[unit];
}

export function computeNotifyAt(eventStartAt: number, amount: number, unit: ReminderUnit): number {
  return eventStartAt - reminderOffsetMs(amount, unit);
}
