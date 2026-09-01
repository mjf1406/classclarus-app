import type { TFunction } from "i18next";

import i18n from "@/i18n";
import { getLanguageOption, isAppLanguage, toIntlLocale } from "@/lib/languages";
import { formatWeekdayName } from "@/lib/timetable/utils";

export type ActivitySummaryInput = {
  summary: string;
  summaryKey?: string;
  metadata?: Record<string, string>;
};

type ResolvedSummary = {
  key: string;
  params: Record<string, string>;
};

const ROLE_LABEL_KEYS = {
  owner: "roleOwner",
  teacher: "roleTeacher",
  assistant_teacher: "roleAssistantTeacher",
  student: "roleStudent",
  guardian: "roleGuardian",
} as const;

const QUOTED_NAME = String.raw`["“](.+?)["”]`;

function languageLabel(code: string | undefined): string {
  if (!code) {
    return "";
  }
  if (isAppLanguage(code)) {
    return getLanguageOption(code).label;
  }
  return code;
}

function roleLabel(role: string | undefined, t: TFunction<"classes">): string {
  if (!role) {
    return "";
  }
  if (role in ROLE_LABEL_KEYS) {
    return t(ROLE_LABEL_KEYS[role as keyof typeof ROLE_LABEL_KEYS]);
  }
  return role;
}

function prepareParams(
  metadata: Record<string, string> | undefined,
  t: TFunction<"classes">,
): Record<string, string> {
  const params: Record<string, string> = { ...(metadata ?? {}) };

  if (params.role) {
    params.role = roleLabel(params.role, t);
  }
  if (params.fromRole) {
    params.fromRole = roleLabel(params.fromRole, t);
  }
  if (params.toRole) {
    params.toRole = roleLabel(params.toRole, t);
  }
  if (params.studentLanguage !== undefined) {
    params.language = languageLabel(params.studentLanguage);
  }
  if (params.studentCount !== undefined && params.count === undefined) {
    params.count = params.studentCount;
  }
  if (params.createdCount !== undefined && params.count === undefined) {
    params.count = params.createdCount;
  }
  if (params.day) {
    params.day = formatWeekdayName(params.day, toIntlLocale(i18n.language));
  }
  if (params.scope === "thisWeek") {
    params.scope = t("activityScopeThisWeek");
  } else if (params.scope === "fromWeek") {
    params.scope = t("activityScopeFromWeek");
  } else if (params.scope === "allWeeks") {
    params.scope = t("activityScopeAllWeeks");
  }

  return params;
}

function matchQuoted(summary: string, prefix: string): string | null {
  const re = new RegExp(`^${prefix} ${QUOTED_NAME}$`);
  const match = summary.match(re);
  return match?.[1] ?? null;
}

/**
 * Infer summaryKey + params from legacy English `summary` / metadata
 * so existing activity rows localize without a data migration.
 */
export function resolveActivitySummary(event: ActivitySummaryInput): ResolvedSummary | null {
  const summaryKey = event.summaryKey?.trim();
  const metadata = event.metadata ?? {};
  const summary = event.summary;

  if (summaryKey) {
    return { key: summaryKey, params: { ...metadata } };
  }

  if (metadata.studentLanguage !== undefined) {
    return {
      key: "activitySummary_setStudentLanguage",
      params: { ...metadata },
    };
  }

  let name = matchQuoted(summary, "Created class");
  if (name) return { key: "activitySummary_createdClass", params: { name } };

  name = matchQuoted(summary, "Updated class settings for");
  if (name) return { key: "activitySummary_updatedClassSettings", params: { name } };

  name = matchQuoted(summary, "Archived class");
  if (name) return { key: "activitySummary_archivedClass", params: { name } };

  name = matchQuoted(summary, "Unarchived class");
  if (name) return { key: "activitySummary_unarchivedClass", params: { name } };

  name = matchQuoted(summary, "Archived task");
  if (name) return { key: "activitySummary_archivedTask", params: { name } };

  name = matchQuoted(summary, "Unarchived task");
  if (name) return { key: "activitySummary_unarchivedTask", params: { name } };

  name = matchQuoted(summary, "Set dashboard banner for");
  if (name) return { key: "activitySummary_setDashboardBanner", params: { name } };

  name = matchQuoted(summary, "Cleared dashboard banner for");
  if (name) return { key: "activitySummary_clearedDashboardBanner", params: { name } };

  name = matchQuoted(summary, "Transferred ownership of");
  if (name) return { key: "activitySummary_transferredOwnership", params: { name } };

  const languageMatch = summary.match(/^Set student language to (.+)$/);
  if (languageMatch) {
    return {
      key: "activitySummary_setStudentLanguage",
      params: { studentLanguage: languageMatch[1] ?? "" },
    };
  }

  const sectionHeadingSize = summary.match(/^Updated classroom section heading size to (\d+)px$/);
  if (sectionHeadingSize) {
    return {
      key: "activitySummary_setDisplaySectionHeadingFontSize",
      params: { size: sectionHeadingSize[1] ?? "" },
    };
  }

  name = matchQuoted(summary, "Created group");
  if (name) return { key: "activitySummary_createdGroup", params: { name } };

  name = matchQuoted(summary, "Updated group");
  if (name) return { key: "activitySummary_updatedGroup", params: { name } };

  name = matchQuoted(summary, "Set image for group");
  if (name) return { key: "activitySummary_setGroupImage", params: { name } };

  name = matchQuoted(summary, "Cleared image for group");
  if (name) return { key: "activitySummary_clearedGroupImage", params: { name } };

  name = matchQuoted(summary, "Deleted group");
  if (name) return { key: "activitySummary_deletedGroup", params: { name } };

  const createdTeamInGroups = summary.match(
    new RegExp(`^Created team ${QUOTED_NAME} in (\\d+) groups$`),
  );
  if (createdTeamInGroups) {
    return {
      key: "activitySummary_createdTeamInGroups",
      params: { name: createdTeamInGroups[1] ?? "", count: createdTeamInGroups[2] ?? "" },
    };
  }

  name = matchQuoted(summary, "Created team");
  if (name) return { key: "activitySummary_createdTeam", params: { name } };

  const copiedTeamToGroups = summary.match(
    new RegExp(`^Copied team ${QUOTED_NAME} to (\\d+) groups$`),
  );
  if (copiedTeamToGroups) {
    return {
      key: "activitySummary_copiedTeamToGroups",
      params: { name: copiedTeamToGroups[1] ?? "", count: copiedTeamToGroups[2] ?? "" },
    };
  }

  const copiedTeamToGroup = summary.match(
    new RegExp(`^Copied team ${QUOTED_NAME} to another group$`),
  );
  if (copiedTeamToGroup) {
    return {
      key: "activitySummary_copiedTeamToGroup",
      params: { name: copiedTeamToGroup[1] ?? "" },
    };
  }

  name = matchQuoted(summary, "Updated team");
  if (name) return { key: "activitySummary_updatedTeam", params: { name } };

  name = matchQuoted(summary, "Set image for team");
  if (name) return { key: "activitySummary_setTeamImage", params: { name } };

  name = matchQuoted(summary, "Cleared image for team");
  if (name) return { key: "activitySummary_clearedTeamImage", params: { name } };

  name = matchQuoted(summary, "Deleted team");
  if (name) return { key: "activitySummary_deletedTeam", params: { name } };

  if (summary === "Moved student to ungrouped") {
    return { key: "activitySummary_movedStudentToUngrouped", params: {} };
  }

  name = matchQuoted(summary, "Assigned student to team in group");
  if (name) return { key: "activitySummary_assignedStudentToTeamInGroup", params: { name } };

  name = matchQuoted(summary, "Assigned student to group");
  if (name) return { key: "activitySummary_assignedStudentToGroup", params: { name } };

  const movedStudents = summary.match(
    new RegExp(`^Moved (\\d+) students into group ${QUOTED_NAME}$`),
  );
  if (movedStudents) {
    return {
      key: "activitySummary_movedStudentsIntoGroup",
      params: { count: movedStudents[1] ?? "", name: movedStudents[2] ?? "" },
    };
  }

  const movedStudentsToUngrouped = summary.match(
    new RegExp(`^Moved (\\d+) students from group ${QUOTED_NAME} to ungrouped$`),
  );
  if (movedStudentsToUngrouped) {
    return {
      key: "activitySummary_movedStudentsToUngrouped",
      params: {
        count: movedStudentsToUngrouped[1] ?? "",
        name: movedStudentsToUngrouped[2] ?? "",
      },
    };
  }

  const renamedFile = summary.match(new RegExp(`^Renamed file ${QUOTED_NAME} to ${QUOTED_NAME}$`));
  if (renamedFile) {
    return {
      key: "activitySummary_renamedFile",
      params: { previousName: renamedFile[1] ?? "", name: renamedFile[2] ?? "" },
    };
  }

  name = matchQuoted(summary, "Deleted file");
  if (name) return { key: "activitySummary_deletedFile", params: { name } };

  name = matchQuoted(summary, "Uploaded file");
  if (name) return { key: "activitySummary_uploadedFile", params: { name } };

  const suspended = summary.match(/^Suspended member \((.+)\)$/);
  if (suspended) {
    return { key: "activitySummary_suspendedMember", params: { role: suspended[1] ?? "" } };
  }

  const unsuspended = summary.match(/^Unsuspended member \((.+)\)$/);
  if (unsuspended) {
    return { key: "activitySummary_unsuspendedMember", params: { role: unsuspended[1] ?? "" } };
  }

  const removed = summary.match(/^Removed member \((.+)\)$/);
  if (removed) {
    return { key: "activitySummary_removedMember", params: { role: removed[1] ?? "" } };
  }

  const guardianLinks = summary.match(/^Updated guardian[–-]student links \((\d+) student\(s\)\)$/);
  if (guardianLinks) {
    return {
      key: "activitySummary_updatedGuardianStudentLinks",
      params: { count: guardianLinks[1] ?? "" },
    };
  }

  const changedRole = summary.match(/^Changed member role from (.+) to (.+)$/);
  if (changedRole) {
    return {
      key: "activitySummary_changedMemberRole",
      params: { fromRole: changedRole[1] ?? "", toRole: changedRole[2] ?? "" },
    };
  }

  const createdInvite = summary.match(/^Created invite code for role (.+)$/);
  if (createdInvite) {
    return { key: "activitySummary_createdInviteCode", params: { role: createdInvite[1] ?? "" } };
  }

  const revokedInvite = summary.match(/^Revoked invite code for role (.+)$/);
  if (revokedInvite) {
    return { key: "activitySummary_revokedInviteCode", params: { role: revokedInvite[1] ?? "" } };
  }

  const joined = summary.match(/^Joined class as (.+)$/);
  if (joined) {
    return { key: "activitySummary_joinedClass", params: { role: joined[1] ?? "" } };
  }

  name = matchQuoted(summary, "Viewed class");
  if (name) return { key: "activitySummary_viewedClass", params: { name } };

  if (summary === "Viewed activity log") {
    return { key: "activitySummary_viewedActivityLog", params: {} };
  }
  if (summary === "Viewed invite codes") {
    return { key: "activitySummary_viewedInviteCodes", params: {} };
  }
  if (summary === "Viewed class file library") {
    return { key: "activitySummary_viewedClassFileLibrary", params: {} };
  }
  if (summary === "Exported activity log CSV") {
    return { key: "activitySummary_exportedActivityLogCsv", params: {} };
  }
  if (summary === "Exported groups PDF") {
    return { key: "activitySummary_exportedGroupsPdf", params: {} };
  }

  const viewedMembers = summary.match(/^Viewed (.+) member list$/);
  if (viewedMembers) {
    return {
      key: "activitySummary_viewedMemberList",
      params: { role: viewedMembers[1] ?? "" },
    };
  }

  return null;
}

/**
 * Resolve a localized activity summary from `summaryKey` + metadata.
 * Falls back to parsing legacy English `summary` strings, then the raw summary.
 */
export function formatActivitySummary(
  event: ActivitySummaryInput,
  t: TFunction<"classes">,
): string {
  const resolved = resolveActivitySummary(event);
  if (!resolved) {
    return event.summary;
  }

  const params = prepareParams(resolved.params, t);
  return t(resolved.key, params);
}
