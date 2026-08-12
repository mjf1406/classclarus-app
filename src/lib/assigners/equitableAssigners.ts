import {
  createEquitableAssignerFormSchema,
  EQUITABLE_ASSIGNER_MESSAGES_EN,
  type EquitableAssignerFormValues,
  type EquitableAssignerScope,
} from "../../../convex/lib/assigners/equitableAssignerSchema";
import type { Id } from "../../../convex/_generated/dataModel";

export type EquitableAssignerListItem = {
  _id: Id<"equitableAssigners">;
  _creationTime: number;
  name: string;
  items: string[];
  defaultBalanceGender: boolean;
  defaultScope: EquitableAssignerScope;
  createdBy: Id<"users">;
  createdAt: number;
  updatedAt: number;
  runCount: number;
  latestRunId: Id<"equitableAssignerRuns"> | null;
  latestRunAt: number | null;
};

export type EquitableAssignerDetail = {
  _id: Id<"equitableAssigners">;
  _creationTime: number;
  classId: Id<"classes">;
  name: string;
  items: string[];
  defaultBalanceGender: boolean;
  defaultScope: EquitableAssignerScope;
  createdBy: Id<"users">;
  createdAt: number;
  updatedAt: number;
};

export type EquitableAssignerRunListItem = {
  _id: Id<"equitableAssignerRuns">;
  _creationTime: number;
  assignerId: Id<"equitableAssigners">;
  ranAt: number;
  ranBy: Id<"users">;
  scope: EquitableAssignerScope;
  balanceGender: boolean;
  assignmentCount: number;
};

export type EquitableAssignerAssignment = {
  studentUserId: Id<"users">;
  studentDisplayName: string;
  item: string;
  rosterNumber?: number;
  firstName?: string;
  lastName?: string;
  groupId?: Id<"groups">;
  groupName?: string;
};

export type EquitableAssignerRunDetail = {
  _id: Id<"equitableAssignerRuns">;
  _creationTime: number;
  classId: Id<"classes">;
  assignerId: Id<"equitableAssigners">;
  assignerName: string;
  ranAt: number;
  ranBy: Id<"users">;
  scope: EquitableAssignerScope;
  balanceGender: boolean;
  itemsSnapshot: string[];
  assignments: EquitableAssignerAssignment[];
};

export type EquitableAssignerDisplayRun = EquitableAssignerRunDetail & {
  nameFormat: {
    order: "firstLast" | "lastFirst";
    space: boolean;
  };
};

export function createClientEquitableAssignerFormSchema(
  messages: Partial<typeof EQUITABLE_ASSIGNER_MESSAGES_EN> = {},
) {
  return createEquitableAssignerFormSchema({ ...EQUITABLE_ASSIGNER_MESSAGES_EN, ...messages });
}

export function emptyEquitableAssignerFormValues(): EquitableAssignerFormValues {
  return {
    name: "",
    items: [""],
    defaultBalanceGender: false,
    defaultScope: "class",
  };
}

export function equitableAssignerFormValuesFromDetail(
  detail: EquitableAssignerDetail,
): EquitableAssignerFormValues {
  return {
    name: detail.name,
    items: detail.items.length > 0 ? [...detail.items] : [""],
    defaultBalanceGender: detail.defaultBalanceGender,
    defaultScope: detail.defaultScope,
  };
}

export function equitableAssignerMutationPayloadFromForm(values: EquitableAssignerFormValues) {
  const trimmedItems = values.items.map((item) => item.trim()).filter((item) => item.length > 0);
  return {
    name: values.name.trim(),
    items: trimmedItems,
    defaultBalanceGender: values.defaultBalanceGender,
    defaultScope: values.defaultScope,
  };
}

export function equitableAssignerDisplayUrl(runId: Id<"equitableAssignerRuns">): string {
  return new URL(`/de/${runId}`, window.location.origin).href;
}

export function formatEquitableAssignerScope(
  scope: EquitableAssignerScope,
  t: (key: string) => string,
): string {
  return scope === "groups" ? t("equitableScopeGroups") : t("equitableScopeClass");
}

export function formatEquitableAssignerBalanceGender(
  balanceGender: boolean,
  t: (key: string) => string,
): string {
  return balanceGender ? t("equitableBalanceGenderOn") : t("equitableBalanceGenderOff");
}

export type EquitableAssignerRunSortKey = "ranAt" | "scope" | "balanceGender" | "assignmentCount";
export type EquitableAssignerRunSortDirection = "asc" | "desc";

export function nextEquitableAssignerRunSortState(
  currentKey: EquitableAssignerRunSortKey,
  currentDirection: EquitableAssignerRunSortDirection,
  nextKey: EquitableAssignerRunSortKey,
): { sortKey: EquitableAssignerRunSortKey; sortDirection: EquitableAssignerRunSortDirection } {
  if (currentKey === nextKey) {
    return {
      sortKey: currentKey,
      sortDirection: currentDirection === "asc" ? "desc" : "asc",
    };
  }
  return {
    sortKey: nextKey,
    sortDirection: nextKey === "ranAt" || nextKey === "assignmentCount" ? "desc" : "asc",
  };
}

function compareEquitableAssignerRuns(
  a: EquitableAssignerRunListItem,
  b: EquitableAssignerRunListItem,
  sortKey: EquitableAssignerRunSortKey,
  direction: EquitableAssignerRunSortDirection,
): number {
  const dir = direction === "asc" ? 1 : -1;
  switch (sortKey) {
    case "ranAt":
      return (a.ranAt - b.ranAt) * dir;
    case "scope":
      return a.scope.localeCompare(b.scope) * dir;
    case "balanceGender":
      return (Number(a.balanceGender) - Number(b.balanceGender)) * dir;
    case "assignmentCount":
      return (a.assignmentCount - b.assignmentCount) * dir;
  }
}

export function sortEquitableAssignerRuns(
  runs: EquitableAssignerRunListItem[],
  sortKey: EquitableAssignerRunSortKey,
  direction: EquitableAssignerRunSortDirection,
): EquitableAssignerRunListItem[] {
  return [...runs].sort((a, b) => {
    const primary = compareEquitableAssignerRuns(a, b, sortKey, direction);
    if (primary !== 0) return primary;
    return b.ranAt - a.ranAt;
  });
}

export type { EquitableAssignerFormValues, EquitableAssignerScope };
