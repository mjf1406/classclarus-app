import { describe, expect, test } from "vite-plus/test";

import { formatActivitySummary } from "./formatActivitySummary";

const ROLE_LABELS: Record<string, string> = {
  roleOwner: "Owner",
  roleTeacher: "Teacher",
  roleAssistantTeacher: "Assistant teacher",
  roleStudent: "Student",
  roleGuardian: "Guardian",
};

const STRINGS: Record<string, string> = {
  activitySummary_setStudentLanguage: "Set student language to {{language}}",
  activitySummary_createdGroup: 'Created group "{{name}}"',
  activitySummary_createdCalendarEvent: 'Created calendar event "{{name}}"',
  activitySummary_updatedTimetableLesson: 'Updated timetable lesson for "{{name}}"',
  activitySummary_setTimezone: "Set class time zone to {{timezone}}",
  activitySummary_setDisplaySectionHeadingFontSize:
    "Updated classroom section heading size to {{size}}px",
  activitySummary_viewedClass: 'Viewed class "{{name}}"',
  activitySummary_viewedActivityLog: "Viewed activity log",
  activitySummary_exportedGroupsPdf: "Exported groups PDF",
  activitySummary_removedMember: "Removed member ({{role}})",
  activitySummary_changedMemberRole: "Changed member role from {{fromRole}} to {{toRole}}",
  activitySummary_movedStudentsIntoGroup: 'Moved {{count}} students into group "{{name}}"',
  activitySummary_movedStudentsToUngrouped:
    'Moved {{count}} students from group "{{name}}" to ungrouped',
  activitySummary_createdTeamInGroups: 'Created team "{{name}}" in {{count}} groups',
  activitySummary_copiedTeamToGroup: 'Copied team "{{name}}" to another group',
  activitySummary_disabledTimetableSlot:
    "Disabled timetable slot {{startTime}}–{{endTime}} on {{day}} ({{scope}})",
  activityScopeThisWeek: "this week",
  activityScopeFromWeek: "this week and future weeks",
  activityScopeAllWeeks: "all weeks",
  ...ROLE_LABELS,
};

const t = ((key: string, options?: Record<string, string>) => {
  const template = STRINGS[key] ?? key;
  if (!options) {
    return template;
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => options[name] ?? "");
}) as Parameters<typeof formatActivitySummary>[1];

describe("formatActivitySummary", () => {
  test("returns stored summary when nothing can be resolved", () => {
    expect(formatActivitySummary({ summary: "Unknown custom event" }, t)).toBe(
      "Unknown custom event",
    );
  });

  test("formats setStudentLanguage with language autonym", () => {
    expect(
      formatActivitySummary(
        {
          summary: "Set student language to zhs",
          summaryKey: "activitySummary_setStudentLanguage",
          metadata: { studentLanguage: "zhs" },
        },
        t,
      ),
    ).toBe("Set student language to 简体中文");
  });

  test("formats legacy student-language rows that only have metadata", () => {
    expect(
      formatActivitySummary(
        {
          summary: "Set student language to en",
          metadata: { studentLanguage: "en" },
        },
        t,
      ),
    ).toBe("Set student language to English (US)");
  });

  test("formats legacy English summaries without summaryKey", () => {
    expect(formatActivitySummary({ summary: 'Viewed class "Donkey"' }, t)).toBe(
      'Viewed class "Donkey"',
    );
    expect(formatActivitySummary({ summary: "Viewed activity log" }, t)).toBe(
      "Viewed activity log",
    );
    expect(formatActivitySummary({ summary: "Exported groups PDF" }, t)).toBe(
      "Exported groups PDF",
    );
    expect(formatActivitySummary({ summary: "Removed member (student)" }, t)).toBe(
      "Removed member (Student)",
    );
    expect(
      formatActivitySummary({ summary: "Changed member role from teacher to student" }, t),
    ).toBe("Changed member role from Teacher to Student");
    expect(formatActivitySummary({ summary: "Created team “Alpha” in 3 groups" }, t)).toBe(
      'Created team "Alpha" in 3 groups',
    );
    expect(formatActivitySummary({ summary: "Copied team “Alpha” to another group" }, t)).toBe(
      'Copied team "Alpha" to another group',
    );
    expect(
      formatActivitySummary({ summary: "Updated classroom section heading size to 32px" }, t),
    ).toBe("Updated classroom section heading size to 32px");
    expect(formatActivitySummary({ summary: "Moved 4 students into group “Room A”" }, t)).toBe(
      'Moved 4 students into group "Room A"',
    );
    expect(
      formatActivitySummary({ summary: "Moved 3 students from group “Room A” to ungrouped" }, t),
    ).toBe('Moved 3 students from group "Room A" to ungrouped');
  });

  test("uses summaryKey with metadata for new rows", () => {
    expect(
      formatActivitySummary(
        {
          summary: "Created group Foo",
          summaryKey: "activitySummary_createdGroup",
          metadata: { name: "Foo" },
        },
        t,
      ),
    ).toBe('Created group "Foo"');
    expect(
      formatActivitySummary(
        {
          summary: 'Created calendar event "Field trip"',
          summaryKey: "activitySummary_createdCalendarEvent",
          metadata: { name: "Field trip" },
        },
        t,
      ),
    ).toBe('Created calendar event "Field trip"');
    expect(
      formatActivitySummary(
        {
          summary: 'Updated timetable lesson for "Math"',
          summaryKey: "activitySummary_updatedTimetableLesson",
          metadata: { name: "Math" },
        },
        t,
      ),
    ).toBe('Updated timetable lesson for "Math"');
  });

  test("formats a scoped timetable disable with a translated range", () => {
    expect(
      formatActivitySummary(
        {
          summary: "Disabled timetable slot 09:00–10:00 on Monday (this week)",
          summaryKey: "activitySummary_disabledTimetableSlot",
          metadata: {
            day: "Monday",
            startTime: "09:00",
            endTime: "10:00",
            scope: "thisWeek",
          },
        },
        t,
      ),
    ).toBe("Disabled timetable slot 09:00–10:00 on Monday (this week)");
  });
});
