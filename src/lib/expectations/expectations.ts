import type { FunctionReturnType } from "convex/server";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const MAX_EXPECTATION_NAME_LENGTH = 100;
export const MAX_EXPECTATION_DESCRIPTION_LENGTH = 500;
export const MAX_EXPECTATION_UNIT_LENGTH = 40;

export type ExpectationInputType = "number" | "numberRange";
export type ExpectationBulkOperation =
  | "set"
  | "increaseBy"
  | "decreaseBy"
  | "increasePercent"
  | "decreasePercent";

export type ExpectationList = FunctionReturnType<typeof api.expectations.list>;
export type ExpectationListItem = ExpectationList[number];
export type ExpectationDetail = NonNullable<FunctionReturnType<typeof api.expectations.get>>;
export type ExpectationValueList = FunctionReturnType<typeof api.expectations.listValues>;
export type ExpectationValue = ExpectationValueList[number];

export type ExpectationFormValues = {
  name: string;
  description?: string;
  inputType: ExpectationInputType;
  unit: string;
};

export type ExpectationValueDraft = {
  expectationId: Id<"expectations">;
  numberValue?: number;
  rangeMin?: number;
  rangeMax?: number;
  clear?: boolean;
};

export type ExpectationsViewMode = "grid" | "table";

export function isExpectationsViewMode(value: string): value is ExpectationsViewMode {
  return value === "grid" || value === "table";
}

export function filterExpectationsByName(
  expectations: ExpectationList,
  query: string,
): ExpectationList {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return expectations;
  return expectations.filter((item) => {
    const haystack = `${item.name} ${item.description ?? ""} ${item.unit}`.toLowerCase();
    return haystack.includes(trimmed);
  });
}

export function formatExpectationValue(
  expectation: Pick<ExpectationListItem, "inputType" | "unit">,
  value: ExpectationValue | undefined,
  unsetLabel: string,
): string {
  if (!value) return unsetLabel;
  if (expectation.inputType === "number") {
    if (value.numberValue === undefined) return unsetLabel;
    return `${formatNumber(value.numberValue)} ${expectation.unit}`;
  }
  if (value.rangeMin === undefined || value.rangeMax === undefined) return unsetLabel;
  return `${formatNumber(value.rangeMin)}–${formatNumber(value.rangeMax)} ${expectation.unit}`;
}

export function expectationSortValue(
  expectation: Pick<ExpectationListItem, "inputType">,
  value: ExpectationValue | undefined,
): number | null {
  if (!value) return null;
  if (expectation.inputType === "number") {
    return value.numberValue ?? null;
  }
  return value.rangeMin ?? null;
}

export function valuesByExpectationAndStudent(
  values: ExpectationValueList | undefined,
): Map<string, ExpectationValue> {
  const map = new Map<string, ExpectationValue>();
  for (const value of values ?? []) {
    map.set(`${value.expectationId}:${value.studentUserId}`, value);
  }
  return map;
}

export function valuesForStudent(
  values: ExpectationValueList | undefined,
  studentUserId: Id<"users">,
): ExpectationValue[] {
  return (values ?? []).filter((value) => value.studentUserId === studentUserId);
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}
