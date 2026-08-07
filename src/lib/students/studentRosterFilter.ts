import {
  hasGroupTeamMembershipFilters,
  membershipMatchesFilters,
  type GroupTeamFilterState,
  type MembershipByUserId,
} from "@/lib/groups/groupTeamFilters";
import {
  memberMatchesQuery,
  normalizeSearchText,
  type SearchableMember,
} from "@/lib/members/memberSearch";

export type FilterableRosterStudent = SearchableMember;

export type StudentRosterFilterCriteria = {
  query: string;
  groupIds: string[];
  teamIds: string[];
  includeUngrouped: boolean;
};

export type StudentRosterFilterRequest = {
  type: "filter";
  requestId: number;
  items: FilterableRosterStudent[];
  membershipByUserId: MembershipByUserId;
  criteria: StudentRosterFilterCriteria;
};

export type StudentRosterFilterResponse = {
  type: "filterResult";
  requestId: number;
  ids: string[];
};

export function toStudentRosterFilterCriteria(
  state: GroupTeamFilterState,
  query: string,
): StudentRosterFilterCriteria {
  return {
    query,
    groupIds: state.groupIds,
    teamIds: state.teamIds,
    includeUngrouped: state.includeUngrouped,
  };
}

export function hasStudentRosterFilters(criteria: StudentRosterFilterCriteria): boolean {
  return (
    criteria.query.trim().length > 0 ||
    hasGroupTeamMembershipFilters({
      groupIds: criteria.groupIds,
      teamIds: criteria.teamIds,
      includeUngrouped: criteria.includeUngrouped,
    })
  );
}

export function rosterStudentMatchesCriteria(
  item: FilterableRosterStudent,
  membershipByUserId: MembershipByUserId,
  criteria: StudentRosterFilterCriteria,
): boolean {
  const membershipState: GroupTeamFilterState = {
    groupIds: criteria.groupIds,
    teamIds: criteria.teamIds,
    includeUngrouped: criteria.includeUngrouped,
  };

  if (!membershipMatchesFilters(membershipByUserId[item.id], membershipState)) {
    return false;
  }

  const normalizedQuery = normalizeSearchText(criteria.query);
  if (normalizedQuery && !memberMatchesQuery(item, normalizedQuery)) {
    return false;
  }

  return true;
}

/** Pure matcher used by the worker and unit tests. */
export function filterStudentRosterIds(
  items: readonly FilterableRosterStudent[],
  membershipByUserId: MembershipByUserId,
  criteria: StudentRosterFilterCriteria,
): string[] {
  if (!hasStudentRosterFilters(criteria)) {
    return items.map((item) => item.id);
  }

  const ids: string[] = [];
  for (const item of items) {
    if (rosterStudentMatchesCriteria(item, membershipByUserId, criteria)) {
      ids.push(item.id);
    }
  }
  return ids;
}

export function toFilterableRosterStudent(doc: {
  userId: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}): FilterableRosterStudent {
  return {
    id: doc.userId,
    name: doc.name,
    firstName: doc.firstName,
    lastName: doc.lastName,
    email: doc.email,
  };
}
