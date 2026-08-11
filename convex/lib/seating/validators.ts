import { v } from "convex/values";

export const seatingScopeValidator = v.union(
  v.object({ kind: v.literal("class") }),
  v.object({
    kind: v.literal("group"),
    groupIds: v.array(v.id("groups")),
  }),
  v.object({
    kind: v.literal("team"),
    teamIds: v.array(v.id("teams")),
  }),
);

export const seatingAlgorithmResultValidator = v.union(
  v.object({
    status: v.literal("ok"),
    chartId: v.id("seatCharts"),
    assignments: v.array(
      v.object({
        deskItemId: v.string(),
        groupId: v.id("groups"),
        studentUserId: v.id("users"),
      }),
    ),
    violations: v.array(
      v.object({
        constraintId: v.id("seatConstraints"),
        type: v.union(v.literal("neighbor"), v.literal("teammate"), v.literal("zone")),
        polarity: v.union(v.literal("must"), v.literal("mustNot")),
        summary: v.string(),
        studentUserIds: v.array(v.id("users")),
        params: v.object({
          student: v.string(),
          other: v.optional(v.string()),
          currentZone: v.optional(v.string()),
          targetZone: v.optional(v.string()),
          studentSeat: v.optional(v.string()),
          otherSeat: v.optional(v.string()),
          studentTeam: v.optional(v.string()),
          otherTeam: v.optional(v.string()),
        }),
      }),
    ),
    unseatedStudentIds: v.array(v.id("users")),
  }),
  v.object({
    status: v.literal("not_implemented"),
    message: v.string(),
    code: v.literal("SEATING_ALGORITHM_NOT_IMPLEMENTED"),
  }),
);
