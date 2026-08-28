import { describe, expect, test } from "vite-plus/test";

import {
  calendarDayDiff,
  COMING_SOON_DAYS,
  getRazAssessmentSchedule,
  getRazDisplayStatus,
  getRazDisplayStatuses,
  getRazStatusExplanationReason,
} from "@/lib/raz/assessmentSchedule";

describe("getRazAssessmentSchedule", () => {
  test("computes up_to_date window for beginning readers (14–28 days)", () => {
    const anchor = new Date(2026, 0, 1).getTime(); // Jan 1
    const now = new Date(2026, 0, 5).getTime(); // Jan 5 — 10 days before Jan 15
    const schedule = getRazAssessmentSchedule("A", anchor, now);
    expect(schedule).not.toBeNull();
    expect(schedule!.lowerBoundDays).toBe(14);
    expect(schedule!.upperBoundDays).toBe(28);
    expect(schedule!.scheduleStatus).toBe("up_to_date");
    expect(schedule!.daysUntilDue).toBe(10); // Jan 15
    expect(new Date(schedule!.windowStartAt).getDate()).toBe(15);
    expect(new Date(schedule!.windowEndAt).getDate()).toBe(29);
  });

  test("marks coming_soon within 7 days of window start", () => {
    const anchor = new Date(2026, 0, 1).getTime();
    const now = new Date(2026, 0, 10).getTime(); // 5 days before Jan 15
    const schedule = getRazAssessmentSchedule("A", anchor, now);
    expect(schedule!.scheduleStatus).toBe("coming_soon");
    expect(schedule!.daysUntilDue).toBe(5);
    expect(schedule!.daysUntilDue).toBeLessThanOrEqual(COMING_SOON_DAYS);
  });

  test("marks due_now inside the window", () => {
    const anchor = new Date(2026, 0, 1).getTime();
    const now = new Date(2026, 0, 20).getTime();
    const schedule = getRazAssessmentSchedule("A", anchor, now);
    expect(schedule!.scheduleStatus).toBe("due_now");
    expect(schedule!.daysUntilDue).toBe(0);
  });

  test("marks overdue past the upper bound", () => {
    const anchor = new Date(2026, 0, 1).getTime();
    const now = new Date(2026, 1, 5).getTime(); // Feb 5
    const schedule = getRazAssessmentSchedule("A", anchor, now);
    expect(schedule!.scheduleStatus).toBe("overdue");
    expect(schedule!.daysUntilDue).toBeLessThan(0);
  });

  test("returns null for unknown levels", () => {
    expect(getRazAssessmentSchedule("ZZ", Date.now())).toBeNull();
  });

  test("marks overdue when never assessed (initial level only)", () => {
    const anchor = new Date(2026, 0, 1).getTime();
    const now = new Date(2026, 0, 5).getTime(); // would be up_to_date if assessed
    const schedule = getRazAssessmentSchedule("A", anchor, now, null);
    expect(schedule!.scheduleStatus).toBe("overdue");
    expect(schedule!.daysUntilDue).toBe(-1);
    expect(schedule!.windowStartAt).toBe(new Date(2026, 0, 5).getTime());
    expect(schedule!.windowEndAt).toBe(new Date(2026, 0, 5).getTime());
  });
});

describe("getRazDisplayStatus", () => {
  test("RTI returns dual statuses (rti + overdue)", () => {
    const anchor = new Date(2026, 0, 1).getTime();
    const now = new Date(2026, 0, 5).getTime();
    expect(
      getRazDisplayStatuses({
        level: "A",
        scheduleAnchorAt: anchor,
        lastAssessedAt: anchor,
        manualStatus: "rti",
        nowMs: now,
      }),
    ).toEqual(["rti", "overdue"]);
    expect(
      getRazDisplayStatus({
        level: "A",
        scheduleAnchorAt: anchor,
        lastAssessedAt: anchor,
        manualStatus: "rti",
        nowMs: now,
      }),
    ).toBe("rti");
  });

  test("manual pending wins over schedule", () => {
    const anchor = new Date(2026, 0, 1).getTime();
    const now = new Date(2026, 1, 5).getTime();
    expect(
      getRazDisplayStatuses({
        level: "A",
        scheduleAnchorAt: anchor,
        lastAssessedAt: anchor,
        manualStatus: "pending",
        nowMs: now,
      }),
    ).toEqual(["pending"]);
  });

  test("manual ineligible wins over schedule (no auto-scheduling)", () => {
    const anchor = new Date(2026, 0, 1).getTime();
    const now = new Date(2026, 1, 5).getTime();
    expect(
      getRazDisplayStatuses({
        level: "Z2",
        scheduleAnchorAt: anchor,
        lastAssessedAt: anchor,
        manualStatus: "ineligible",
        nowMs: now,
      }),
    ).toEqual(["ineligible"]);
  });

  test("falls back to schedule when manual cleared", () => {
    const anchor = new Date(2026, 0, 1).getTime();
    const now = new Date(2026, 0, 20).getTime();
    expect(
      getRazDisplayStatuses({
        level: "A",
        scheduleAnchorAt: anchor,
        lastAssessedAt: anchor,
        manualStatus: null,
        nowMs: now,
      }),
    ).toEqual(["due_now"]);
  });

  test("initial level only (no assessments) is overdue", () => {
    const anchor = new Date(2026, 0, 1).getTime();
    const now = new Date(2026, 0, 5).getTime();
    expect(
      getRazDisplayStatuses({
        level: "A",
        scheduleAnchorAt: anchor,
        lastAssessedAt: null,
        manualStatus: null,
        nowMs: now,
      }),
    ).toEqual(["overdue"]);
  });

  test("RTI still dual-status when never assessed", () => {
    const anchor = new Date(2026, 0, 1).getTime();
    const now = new Date(2026, 0, 5).getTime();
    expect(
      getRazDisplayStatuses({
        level: "A",
        scheduleAnchorAt: anchor,
        lastAssessedAt: null,
        manualStatus: "rti",
        nowMs: now,
      }),
    ).toEqual(["rti", "overdue"]);
  });

  test("forceOverdue marks schedule overdue for RTI retest", () => {
    const anchor = new Date(2026, 0, 1).getTime();
    const now = new Date(2026, 0, 5).getTime();
    const schedule = getRazAssessmentSchedule("A", anchor, now, anchor, {
      forceOverdue: true,
    });
    expect(schedule!.scheduleStatus).toBe("overdue");
    expect(schedule!.daysUntilDue).toBe(-1);
  });
});

describe("getRazStatusExplanationReason", () => {
  test("RTI explanation wins over schedule", () => {
    expect(
      getRazStatusExplanationReason({
        manualStatus: "rti",
        lastAssessedAt: 1,
        scheduleStatus: "up_to_date",
      }),
    ).toBe("rti");
  });

  test("ineligible explanation wins over schedule", () => {
    expect(
      getRazStatusExplanationReason({
        manualStatus: "ineligible",
        lastAssessedAt: 1,
        scheduleStatus: "overdue",
      }),
    ).toBe("ineligible");
  });

  test("distinguishes never-assessed overdue from window overdue", () => {
    expect(
      getRazStatusExplanationReason({
        manualStatus: null,
        lastAssessedAt: null,
        scheduleStatus: "overdue",
      }),
    ).toBe("overdue_never_assessed");
    expect(
      getRazStatusExplanationReason({
        manualStatus: null,
        lastAssessedAt: 1,
        scheduleStatus: "overdue",
      }),
    ).toBe("overdue_window");
  });
});

describe("calendarDayDiff", () => {
  test("counts local calendar days", () => {
    const from = new Date(2026, 0, 1, 23, 0).getTime();
    const to = new Date(2026, 0, 3, 1, 0).getTime();
    expect(calendarDayDiff(from, to)).toBe(2);
  });
});
