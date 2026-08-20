import type { Id } from "../../_generated/dataModel.js";

export type EquitablePriorAssignmentRow = {
  studentUserId: string;
  item: string;
};

export type EquitableRosterMatrixStudentCounts = {
  studentUserId: Id<"users">;
  counts: Array<{ item: string; count: number }>;
};

export type EquitablePartnerRunAssignment = {
  studentUserId: string;
  item: string;
  groupId?: string;
  firstName?: string;
  lastName?: string;
  studentDisplayName?: string;
};

export type EquitablePartnerRun = {
  assignments: ReadonlyArray<EquitablePartnerRunAssignment>;
};

export type EquitablePartnerSummary = {
  partnerUserId: Id<"users">;
  count: number;
  firstName?: string;
  lastName?: string;
  name?: string;
};

export type EquitableStudentPartners = {
  studentUserId: Id<"users">;
  partners: EquitablePartnerSummary[];
};

function cohortKey(groupId: string | undefined, item: string): string {
  return `${groupId ?? ""}::${item}`;
}

function partnerSortValue(partner: EquitablePartnerSummary): string {
  const parts = [partner.lastName, partner.firstName].filter(Boolean).join(" ");
  return (parts || partner.name || partner.partnerUserId).toLowerCase();
}

type PartnerAggregate = {
  count: number;
  firstName?: string;
  lastName?: string;
  name?: string;
};

function recordPartner(
  byStudent: Map<string, Map<string, PartnerAggregate>>,
  studentUserId: string,
  partner: EquitablePartnerRunAssignment,
): void {
  const partners = byStudent.get(studentUserId);
  if (!partners) return;
  const existing = partners.get(partner.studentUserId) ?? { count: 0 };
  existing.count += 1;
  if (partner.firstName !== undefined) existing.firstName = partner.firstName;
  if (partner.lastName !== undefined) existing.lastName = partner.lastName;
  if (partner.studentDisplayName !== undefined) existing.name = partner.studentDisplayName;
  partners.set(partner.studentUserId, existing);
}

/**
 * Count same-run, same-item, same-group co-assignees for each current student.
 * Snapshot names come from the partner's latest assignment.
 */
export function buildEquitablePartnerSummaries(
  studentUserIds: Id<"users">[],
  runs: ReadonlyArray<EquitablePartnerRun>,
): EquitableStudentPartners[] {
  const byStudent = new Map<string, Map<string, PartnerAggregate>>();
  for (const studentUserId of studentUserIds) {
    byStudent.set(studentUserId, new Map());
  }

  for (const run of runs) {
    const cohorts = new Map<string, EquitablePartnerRunAssignment[]>();
    for (const assignment of run.assignments) {
      const key = cohortKey(assignment.groupId, assignment.item);
      const list = cohorts.get(key) ?? [];
      list.push(assignment);
      cohorts.set(key, list);
    }

    for (const cohort of cohorts.values()) {
      if (cohort.length < 2) continue;
      for (let i = 0; i < cohort.length; i += 1) {
        for (let j = i + 1; j < cohort.length; j += 1) {
          const left = cohort[i]!;
          const right = cohort[j]!;
          if (left.studentUserId === right.studentUserId) continue;
          recordPartner(byStudent, left.studentUserId, right);
          recordPartner(byStudent, right.studentUserId, left);
        }
      }
    }
  }

  return studentUserIds.map((studentUserId) => {
    const partners = [...(byStudent.get(studentUserId)?.entries() ?? [])]
      .map(([partnerUserId, aggregate]) => ({
        partnerUserId: partnerUserId as Id<"users">,
        count: aggregate.count,
        ...(aggregate.firstName !== undefined ? { firstName: aggregate.firstName } : {}),
        ...(aggregate.lastName !== undefined ? { lastName: aggregate.lastName } : {}),
        ...(aggregate.name !== undefined ? { name: aggregate.name } : {}),
      }))
      .sort((a, b) => {
        if (a.count !== b.count) return b.count - a.count;
        return partnerSortValue(a).localeCompare(partnerSortValue(b));
      });
    return { studentUserId, partners };
  });
}

/** Aggregate per-student counts for the assigner's current item list. */
export function buildEquitableRosterMatrixCounts(
  items: string[],
  studentUserIds: Id<"users">[],
  priorAssignments: EquitablePriorAssignmentRow[],
): EquitableRosterMatrixStudentCounts[] {
  const itemSet = new Set(items);
  const countsByStudent = new Map<string, Map<string, number>>();

  for (const studentUserId of studentUserIds) {
    countsByStudent.set(studentUserId, new Map(items.map((item) => [item, 0] as const)));
  }

  for (const row of priorAssignments) {
    if (!itemSet.has(row.item)) continue;
    const studentCounts = countsByStudent.get(row.studentUserId);
    if (!studentCounts) continue;
    studentCounts.set(row.item, (studentCounts.get(row.item) ?? 0) + 1);
  }

  return studentUserIds.map((studentUserId) => ({
    studentUserId,
    counts: items.map((item) => ({
      item,
      count: countsByStudent.get(studentUserId)?.get(item) ?? 0,
    })),
  }));
}
