import { addDaysToDateKey, compareDateKeys } from "../calendar/dateKey.js";
import {
  getIsoWeekYearAndNumberFromDateKey,
  WEEKDAY_NAMES,
  weekdayNameFromDateKey,
  type WeekdayName,
} from "./timetableSchema.js";

export const SLOT_DISABLE_SCOPES = ["thisWeek", "fromWeek", "allWeeks"] as const;

export type SlotDisableScope = (typeof SLOT_DISABLE_SCOPES)[number];

export type IsoWeek = {
  year: number;
  weekNumber: number;
};

export type SlotDisableState = {
  globallyDisabled: boolean;
  disabledWeeks: Array<IsoWeek>;
};

export function isSlotDisableScope(value: string): value is SlotDisableScope {
  return (SLOT_DISABLE_SCOPES as ReadonlyArray<string>).includes(value);
}

export function isWeekdayName(value: string): value is WeekdayName {
  return (WEEKDAY_NAMES as ReadonlyArray<string>).includes(value);
}

export function compareIsoWeeks(a: IsoWeek, b: IsoWeek): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.weekNumber - b.weekNumber;
}

export function isoWeekKey(week: IsoWeek): string {
  return `${week.year}-W${String(week.weekNumber).padStart(2, "0")}`;
}

export function uniqueIsoWeeks(weeks: Array<IsoWeek>): Array<IsoWeek> {
  const seen = new Set<string>();
  const unique: Array<IsoWeek> = [];
  for (const week of weeks) {
    const key = isoWeekKey(week);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(week);
  }
  return unique;
}

export function listIsoWeeksForWeekdayInRange(
  startDateKey: string,
  endDateKey: string,
  weekday: WeekdayName,
): Array<IsoWeek> {
  if (compareDateKeys(endDateKey, startDateKey) < 0) return [];

  let dateKey = startDateKey;
  while (compareDateKeys(dateKey, endDateKey) <= 0) {
    if (weekdayNameFromDateKey(dateKey) === weekday) break;
    dateKey = addDaysToDateKey(dateKey, 1);
  }

  const weeks: Array<IsoWeek> = [];
  while (compareDateKeys(dateKey, endDateKey) <= 0) {
    weeks.push(getIsoWeekYearAndNumberFromDateKey(dateKey));
    dateKey = addDaysToDateKey(dateKey, 7);
  }
  return weeks;
}

export function selectWeeksForScope(
  termWeeks: Array<IsoWeek>,
  selected: IsoWeek,
  scope: SlotDisableScope,
): Array<IsoWeek> {
  if (scope === "thisWeek") {
    return [selected];
  }
  if (scope === "fromWeek") {
    return uniqueIsoWeeks([
      selected,
      ...termWeeks.filter((week) => compareIsoWeeks(week, selected) > 0),
    ]);
  }
  return uniqueIsoWeeks(termWeeks);
}

export function weekIsInScope(week: IsoWeek, selected: IsoWeek, scope: SlotDisableScope): boolean {
  if (scope === "thisWeek") {
    return compareIsoWeeks(week, selected) === 0;
  }
  if (scope === "fromWeek") {
    return compareIsoWeeks(week, selected) >= 0;
  }
  return true;
}

function weekSet(weeks: Array<IsoWeek>): Set<string> {
  return new Set(weeks.map(isoWeekKey));
}

export function applySlotDisableChange(
  state: SlotDisableState,
  termWeeks: Array<IsoWeek>,
  selected: IsoWeek,
  scope: SlotDisableScope,
  disabled: boolean,
): SlotDisableState {
  const scopedWeeks = selectWeeksForScope(termWeeks, selected, scope);

  if (disabled) {
    if (scope === "allWeeks") {
      return { globallyDisabled: true, disabledWeeks: [] };
    }
    if (state.globallyDisabled) {
      return state;
    }
    return {
      globallyDisabled: false,
      disabledWeeks: uniqueIsoWeeks([...state.disabledWeeks, ...scopedWeeks]),
    };
  }

  if (scope === "allWeeks") {
    return { globallyDisabled: false, disabledWeeks: [] };
  }

  const enableKeys = weekSet(scopedWeeks);
  if (state.globallyDisabled) {
    return {
      globallyDisabled: false,
      disabledWeeks: termWeeks.filter((week) => !enableKeys.has(isoWeekKey(week))),
    };
  }

  return {
    globallyDisabled: false,
    disabledWeeks: state.disabledWeeks.filter((week) => !enableKeys.has(isoWeekKey(week))),
  };
}
