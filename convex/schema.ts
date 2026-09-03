import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { languageValidator } from "./lib/languages.js";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,
  /**
   * Extends Convex Auth `users` with an optional self-host/Electron avatar
   * file. Display URLs are resolved at query time from this id (see
   * `resolveUserImageUrl`); OAuth provider URLs remain in `image`.
   */
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    /** Personal `files` row used as the profile photo (self-host / Electron). */
    avatarFileId: v.optional(v.id("files")),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),
  userSettings: defineTable({
    userId: v.id("users"),
    language: languageValidator,
  }).index("by_userId", ["userId"]),
  /**
   * Per-user, per-class UI preferences (e.g. students roster view).
   * Distinct from global `userSettings` (language).
   */
  classUserSettings: defineTable({
    userId: v.id("users"),
    classId: v.id("classes"),
    studentsViewMode: v.optional(v.union(v.literal("grid"), v.literal("table"))),
    studentsColumnOrder: v.optional(v.array(v.string())),
    studentsColumnVisibility: v.optional(v.record(v.string(), v.boolean())),
  })
    .index("by_userId_classId", ["userId", "classId"])
    .index("by_userId", ["userId"])
    .index("by_classId", ["classId"]),
  /**
   * Class-scoped student roster profile (roster #, names, gender, pronouns).
   * Independent of `users.name` / email.
   */
  studentRosters: defineTable({
    classId: v.id("classes"),
    userId: v.id("users"),
    rosterNumber: v.number(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    gender: v.optional(
      v.union(
        v.literal("male"),
        v.literal("female"),
        v.literal("transMale"),
        v.literal("transFemale"),
        v.literal("nonBinary"),
        v.literal("selfDescribe"),
        v.literal("preferNotToSay"),
      ),
    ),
    genderSelfDescribe: v.optional(v.string()),
    pronouns: v.optional(
      v.union(
        v.literal("heHim"),
        v.literal("sheHer"),
        v.literal("theyThem"),
        v.literal("heThey"),
        v.literal("sheThey"),
        v.literal("useNameOnly"),
        v.literal("askSelfDescribe"),
        v.literal("preferNotToSay"),
      ),
    ),
    pronounsSelfDescribe: v.optional(v.string()),
    /** Cached points totals for this class; optional on legacy rows (treat missing as 0). */
    pointsBalance: v.optional(v.number()),
    pointsAwarded: v.optional(v.number()),
    pointsRemoved: v.optional(v.number()),
    pointsRedeemed: v.optional(v.number()),
    /** Today's warning badge; meaningful only when warningDateKey matches today. */
    warningCount: v.optional(v.number()),
    warningDateKey: v.optional(v.string()),
  })
    .index("by_classId_userId", ["classId", "userId"])
    .index("by_classId_rosterNumber", ["classId", "rosterNumber"])
    .index("by_classId", ["classId"])
    .index("by_userId", ["userId"]),
  classes: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    year: v.number(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    /** Class-scoped image file shown on the dashboard. */
    bannerFileId: v.optional(v.id("files")),
    /** UI language forced for students while inside this class. */
    studentLanguage: languageValidator,
    /**
     * IANA time zone for class calendar times and reminder scheduling.
     * Timed events cannot be created until this is set.
     */
    timezone: v.optional(v.string()),
    /**
     * How many upcoming calendar events to list in lesson announcements.
     * Defaults to 3 when unset.
     */
    upcomingAnnouncementEventLimit: v.optional(v.number()),
    /**
     * How roster first/last names are combined for display.
     * Defaults to firstLast + space when unset (pre-backfill rows).
     */
    rosterNameOrder: v.optional(v.union(v.literal("firstLast"), v.literal("lastFirst"))),
    rosterNameSpace: v.optional(v.boolean()),
    /**
     * Lookback for the points-board warning badge (default 1 day).
     * Amount × unit (day / week aligned to pointsBadgeWeekStartDay / month×30)
     * ending on the board dateKey.
     */
    warningWindowAmount: v.optional(v.number()),
    warningWindowUnit: v.optional(v.union(v.literal("day"), v.literal("week"), v.literal("month"))),
    /**
     * Lookback for the points-board minus (red flag) badge (default 1 day).
     */
    minusWindowAmount: v.optional(v.number()),
    minusWindowUnit: v.optional(v.union(v.literal("day"), v.literal("week"), v.literal("month"))),
    /**
     * First weekday for warning/minus lookbacks when the unit is week.
     * Defaults to Monday when unset.
     */
    pointsBadgeWeekStartDay: v.optional(
      v.union(
        v.literal("sunday"),
        v.literal("monday"),
        v.literal("tuesday"),
        v.literal("wednesday"),
        v.literal("thursday"),
        v.literal("friday"),
        v.literal("saturday"),
      ),
    ),
    /**
     * Custom teacher notifications when a student's warning/minus count in the
     * matching lookback window reaches a configured number. Each item is
     * `{ count, action }` with a text-only action (e.g. "Email parents").
     */
    warningAlerts: v.optional(v.array(v.object({ count: v.number(), action: v.string() }))),
    minusAlerts: v.optional(v.array(v.object({ count: v.number(), action: v.string() }))),
    /**
     * Optional public points display (`/p/$pointsPublicSlug`). Slug is retained when disabled.
     */
    pointsPublicEnabled: v.optional(v.boolean()),
    pointsPublicSlug: v.optional(v.string()),
    /** Set while a tracked deletion job is in progress. */
    deletingAt: v.optional(v.number()),
    deletionJobId: v.optional(v.id("classDeletionJobs")),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_pointsPublicSlug", ["pointsPublicSlug"]),
  /** Tracks staged class deletion progress for the owner UI. */
  classDeletionJobs: defineTable({
    classId: v.id("classes"),
    requesterUserId: v.id("users"),
    className: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    currentStage: v.string(),
    completedStageCount: v.number(),
    totalStageCount: v.number(),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_classId", ["classId"])
    .index("by_requesterUserId", ["requesterUserId"])
    .index("by_requesterUserId_status", ["requesterUserId", "status"])
    .index("by_classId_status", ["classId", "status"]),
  joinCodes: defineTable({
    code: v.string(),
    classId: v.id("classes"),
    createdBy: v.id("users"),
    role: v.union(
      v.literal("teacher"),
      v.literal("assistant_teacher"),
      v.literal("student"),
      v.literal("guardian"),
    ),
    expiresAt: v.number(),
    maxUses: v.number(),
    useCount: v.number(),
    expirationJobId: v.optional(v.id("_scheduled_functions")),
    /** Set on per-student guardian invite codes; omitted for class-wide codes. */
    studentUserId: v.optional(v.id("users")),
  })
    .index("by_code", ["code"])
    .index("by_class", ["classId"])
    .index("by_creator", ["createdBy"])
    .index("by_class_student", ["classId", "studentUserId"]),
  /**
   * One card-less trial grant per normalized email.
   * Survives account delete/recreate — never re-grant for the same emailKey.
   */
  trialGrants: defineTable({
    emailKey: v.string(),
    /** Cleared on account deletion; reattached on re-signup via emailKey. */
    userId: v.optional(v.id("users")),
    startedAt: v.number(),
    endsAt: v.number(),
    /** Set by the scheduled `markExpired` job when the trial lapses. */
    expiredAt: v.optional(v.number()),
    expirationJobId: v.optional(v.id("_scheduled_functions")),
  })
    .index("by_emailKey", ["emailKey"])
    .index("by_userId", ["userId"])
    .index("by_endsAt", ["endsAt"]),
  /**
   * Ownership registry for Convex storage blobs.
   * Only finalized uploads (validated MIME/size) get a row.
   * Optional `classId` places the file in a class library (`files:read` for members;
   * `files:create` for owner/teacher; uploader retains update/delete).
   * Absent `classId` = personal / owner-only.
   */
  files: defineTable({
    storageId: v.id("_storage"),
    userId: v.id("users"),
    classId: v.optional(v.id("classes")),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    preset: v.string(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_storageId", ["storageId"])
    .index("by_classId", ["classId"]),
  /**
   * Class groups — containers for optional teams and exclusive student membership.
   */
  groups: defineTable({
    classId: v.id("classes"),
    name: v.string(),
    description: v.optional(v.string()),
    /** Font Awesome icon id (`fas:…` / `far:…`), same format as class icons. */
    icon: v.optional(v.string()),
    /** Class-scoped image file shown as the group avatar (preferred over `icon`). */
    imageFileId: v.optional(v.id("files")),
    updatedAt: v.number(),
  }).index("by_class", ["classId"]),
  /**
   * Teams nested under a group within a class.
   */
  teams: defineTable({
    classId: v.id("classes"),
    groupId: v.id("groups"),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    /** Class-scoped image file shown as the team avatar (preferred over `icon`). */
    imageFileId: v.optional(v.id("files")),
    updatedAt: v.number(),
  })
    .index("by_group", ["groupId"])
    .index("by_class", ["classId"]),
  /**
   * Exclusive student placement: at most one row per (class, student).
   * `teamId` omitted = in the group with no team.
   */
  groupMemberships: defineTable({
    classId: v.id("classes"),
    groupId: v.id("groups"),
    teamId: v.optional(v.id("teams")),
    studentUserId: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_class_student", ["classId", "studentUserId"])
    .index("by_group", ["groupId"])
    .index("by_team", ["teamId"])
    .index("by_class", ["classId"]),
  /**
   * Classroom seat layouts for Assigners — named canvases of desks and fixtures.
   * Items are a bounded per-classroom array (well under Convex array limits).
   */
  seatLayouts: defineTable({
    classId: v.id("classes"),
    name: v.string(),
    canvasWidth: v.number(),
    canvasHeight: v.number(),
    /** Next number stamped on a newly added student desk. */
    nextDeskNumber: v.number(),
    items: v.array(
      v.object({
        id: v.string(),
        kind: v.union(
          v.literal("desk"),
          v.literal("teacherDesk"),
          v.literal("board"),
          v.literal("rect"),
        ),
        label: v.string(),
        deskNumber: v.optional(v.number()),
        teamAssignment: v.optional(
          v.union(
            v.object({
              mode: v.literal("single"),
              groupId: v.id("groups"),
              teamId: v.id("teams"),
            }),
            v.object({
              mode: v.literal("byName"),
              teamName: v.string(),
            }),
          ),
        ),
        /** Free-text zone for seating distribution (desk items only). */
        zoneName: v.optional(v.string()),
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
      }),
    ),
    /**
     * Auto-assign gender parity for this layout.
     * Optional until `seatLayoutGenderParityBackfill` has run; new layouts always set it.
     */
    genderParity: v.optional(
      v.object({
        mode: v.union(v.literal("off"), v.literal("oddEven")),
      }),
    ),
    updatedAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_class", ["classId"])
    .index("by_class_and_name", ["classId", "name"]),
  /**
   * Class-scoped seating constraints for Assigners (shared across all layouts).
   */
  seatConstraints: defineTable({
    classId: v.id("classes"),
    type: v.union(v.literal("neighbor"), v.literal("teammate"), v.literal("zone")),
    polarity: v.union(v.literal("must"), v.literal("mustNot")),
    studentUserId: v.id("users"),
    /** Required for neighbor / teammate. */
    otherStudentUserId: v.optional(v.id("users")),
    /** Required for zone — matches free-text desk zoneName values. */
    zoneName: v.optional(v.string()),
    createdBy: v.id("users"),
    updatedAt: v.number(),
  }).index("by_class", ["classId"]),
  /**
   * Manual seating charts — draft student-to-desk assignments for a layout.
   */
  seatCharts: defineTable({
    classId: v.id("classes"),
    layoutId: v.id("seatLayouts"),
    name: v.string(),
    archivedAt: v.optional(v.number()),
    assignments: v.array(
      v.object({
        deskItemId: v.string(),
        groupId: v.optional(v.id("groups")),
        studentUserId: v.id("users"),
      }),
    ),
    updatedAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_class", ["classId"])
    .index("by_layout", ["layoutId"])
    .index("by_class_layout", ["classId", "layoutId"]),
  /**
   * Immutable seating snapshots created via Record seating.
   */
  seatChartRecords: defineTable({
    classId: v.id("classes"),
    chartId: v.id("seatCharts"),
    recordedAt: v.number(),
    recordedBy: v.id("users"),
    chartName: v.string(),
    layoutId: v.id("seatLayouts"),
    layoutName: v.string(),
    canvasWidth: v.number(),
    canvasHeight: v.number(),
    layoutItems: v.array(
      v.object({
        id: v.string(),
        kind: v.union(
          v.literal("desk"),
          v.literal("teacherDesk"),
          v.literal("board"),
          v.literal("rect"),
        ),
        label: v.string(),
        deskNumber: v.optional(v.number()),
        teamAssignment: v.optional(
          v.union(
            v.object({
              mode: v.literal("single"),
              groupId: v.id("groups"),
              teamId: v.id("teams"),
            }),
            v.object({
              mode: v.literal("byName"),
              teamName: v.string(),
            }),
          ),
        ),
        zoneName: v.optional(v.string()),
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
      }),
    ),
    placedCount: v.number(),
    seatedStudentIds: v.array(v.id("users")),
  })
    .index("by_class", ["classId"])
    .index("by_chart", ["chartId"])
    .index("by_class_chart", ["classId", "chartId"])
    .index("by_chart_recorded", ["chartId", "recordedAt"]),
  /**
   * Per-student placement rows for a recorded seating snapshot.
   */
  seatChartPlacements: defineTable({
    classId: v.id("classes"),
    chartId: v.id("seatCharts"),
    layoutId: v.optional(v.id("seatLayouts")),
    recordId: v.id("seatChartRecords"),
    studentUserId: v.id("users"),
    studentDisplayName: v.string(),
    groupId: v.optional(v.id("groups")),
    deskItemId: v.string(),
    deskNumber: v.optional(v.number()),
    zoneName: v.optional(v.string()),
    teamKey: v.optional(v.string()),
    teamLabel: v.optional(v.string()),
    neighborStudentIds: v.array(v.id("users")),
    neighborDisplayNames: v.array(v.string()),
    combinationKey: v.string(),
    recordedAt: v.number(),
  })
    .index("by_record", ["recordId"])
    .index("by_chart_student_recorded", ["chartId", "studentUserId", "recordedAt"])
    .index("by_layout_student_recorded", ["layoutId", "studentUserId", "recordedAt"])
    .index("by_classId_student_recorded", ["classId", "studentUserId", "recordedAt"]),
  /**
   * Longitudinal seating statistics per student and chart.
   */
  seatChartAggregates: defineTable({
    classId: v.id("classes"),
    chartId: v.id("seatCharts"),
    studentUserId: v.id("users"),
    dimension: v.union(
      v.literal("total"),
      v.literal("seat"),
      v.literal("zone"),
      v.literal("team"),
      v.literal("neighbor"),
      v.literal("combination"),
    ),
    key: v.string(),
    label: v.string(),
    count: v.number(),
    updatedAt: v.number(),
  })
    .index("by_classId", ["classId"])
    .index("by_chart_student", ["chartId", "studentUserId"])
    .index("by_chart_student_dimension", ["chartId", "studentUserId", "dimension"])
    .index("by_chart_student_dimension_key", ["chartId", "studentUserId", "dimension", "key"]),
  /**
   * Longitudinal seating statistics per student and layout (same-layout history for auto-assign).
   */
  seatLayoutAggregates: defineTable({
    classId: v.id("classes"),
    layoutId: v.id("seatLayouts"),
    studentUserId: v.id("users"),
    dimension: v.union(
      v.literal("total"),
      v.literal("seat"),
      v.literal("zone"),
      v.literal("team"),
      v.literal("neighbor"),
      v.literal("combination"),
    ),
    key: v.string(),
    label: v.string(),
    count: v.number(),
    updatedAt: v.number(),
  })
    .index("by_classId", ["classId"])
    .index("by_layout", ["layoutId"])
    .index("by_layout_dimension", ["layoutId", "dimension"])
    .index("by_layout_student", ["layoutId", "studentUserId"])
    .index("by_layout_student_dimension", ["layoutId", "studentUserId", "dimension"])
    .index("by_layout_student_dimension_key", ["layoutId", "studentUserId", "dimension", "key"]),
  /**
   * @deprecated Legacy class-scoped auto-assign settings.
   * Kept only so `seatLayoutGenderParityBackfill` can copy gender parity onto layouts.
   * Remove this table after the backfill has been run on every deployment.
   */
  seatAlgorithmSettings: defineTable({
    classId: v.id("classes"),
    weights: v.object({
      seat: v.number(),
      zone: v.number(),
      team: v.number(),
      neighbor: v.number(),
      gender: v.number(),
      combination: v.number(),
    }),
    genderParity: v.object({
      mode: v.union(v.literal("off"), v.literal("oddEven")),
    }),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  }).index("by_class", ["classId"]),
  /**
   * Many-to-many guardian ↔ student links within a class.
   * Cleared when either side leaves the guardian/student role.
   */
  guardianStudentLinks: defineTable({
    classId: v.id("classes"),
    guardianUserId: v.id("users"),
    studentUserId: v.id("users"),
    createdAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_class_guardian", ["classId", "guardianUserId"])
    .index("by_class_student", ["classId", "studentUserId"])
    .index("by_class_guardian_student", ["classId", "guardianUserId", "studentUserId"]),
  /**
   * One attendance session per class per local calendar day (`dateKey` YYYY-MM-DD).
   */
  attendanceSessions: defineTable({
    classId: v.id("classes"),
    /** Client-local school day key (YYYY-MM-DD), not UTC. */
    dateKey: v.string(),
    takenBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_classId_dateKey", ["classId", "dateKey"])
    .index("by_classId", ["classId"]),
  /**
   * Per-student attendance status for a session. Unset students have no row.
   */
  attendanceRecords: defineTable({
    classId: v.id("classes"),
    sessionId: v.id("attendanceSessions"),
    /** Denormalized from session for history / range queries. */
    dateKey: v.string(),
    studentUserId: v.id("users"),
    status: v.union(v.literal("present"), v.literal("absent"), v.literal("late")),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_session_student", ["sessionId", "studentUserId"])
    .index("by_classId_dateKey", ["classId", "dateKey"])
    .index("by_classId_student", ["classId", "studentUserId"])
    .index("by_classId_student_dateKey", ["classId", "studentUserId", "dateKey"]),
  /**
   * Class announcements — teacher-authored posts with optional public slug pages.
   */
  announcements: defineTable({
    classId: v.id("classes"),
    authorId: v.id("users"),
    title: v.string(),
    /** Serialized TipTap/ProseMirror JSON document. */
    bodyJson: v.string(),
    isPublic: v.boolean(),
    /** Unguessable slug for `/a/$publicSlug`; retained when unpublished. */
    publicSlug: v.optional(v.string()),
    attachmentFileIds: v.array(v.id("files")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_classId_createdAt", ["classId", "createdAt"])
    .index("by_publicSlug", ["publicSlug"]),
  /**
   * Class tasks — teacher-authored checklist items with per-student completion.
   */
  tasks: defineTable({
    classId: v.id("classes"),
    name: v.string(),
    description: v.optional(v.string()),
    /** Optional local due date/time: YYYY-MM-DD or YYYY-MM-DDTHH:mm. */
    dueDateKey: v.optional(v.string()),
    /** Set when this task was created from an assignment procedure step. */
    assignmentId: v.optional(v.id("assignments")),
    /** @deprecated Use `attachmentFileIds`. Kept during migration of legacy worksheet images. */
    worksheetImageFileId: v.optional(v.id("files")),
    /** Class-library images and documents (PDF, DOCX, TXT), up to five. */
    attachmentFileIds: v.optional(v.array(v.id("files"))),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_classId", ["classId"])
    .index("by_classId_updatedAt", ["classId", "updatedAt"])
    .index("by_assignmentId", ["assignmentId"])
    .index("by_worksheetImageFileId", ["worksheetImageFileId"]),
  /**
   * Sparse per-student task completion. Missing row = not done.
   */
  taskCompletions: defineTable({
    classId: v.id("classes"),
    taskId: v.id("tasks"),
    studentUserId: v.id("users"),
    completedAt: v.number(),
    completedBy: v.id("users"),
  })
    .index("by_task_student", ["taskId", "studentUserId"])
    .index("by_task", ["taskId"])
    .index("by_classId", ["classId"]),
  /**
   * Class assignments — teacher-authored work with optional scoring structure,
   * instructions, procedure steps, and student link submissions.
   */
  assignments: defineTable({
    classId: v.id("classes"),
    name: v.string(),
    subject: v.optional(v.string()),
    unit: v.optional(v.string()),
    /** Optional local due date/time: YYYY-MM-DD or YYYY-MM-DDTHH:mm. */
    dueDateKey: v.optional(v.string()),
    /** Optional TipTap/ProseMirror JSON instructions. */
    instructionsJson: v.optional(v.string()),
    scoringMode: v.union(v.literal("total"), v.literal("sections")),
    totalPoints: v.optional(v.number()),
    sections: v.optional(
      v.array(
        v.object({
          key: v.string(),
          name: v.string(),
          type: v.union(
            v.literal("points"),
            v.literal("rubricLevels"),
            v.literal("rubricCheckboxes"),
          ),
          maxPoints: v.optional(v.number()),
          levels: v.optional(
            v.array(
              v.object({
                key: v.string(),
                description: v.string(),
                points: v.number(),
              }),
            ),
          ),
          items: v.optional(
            v.array(
              v.object({
                key: v.string(),
                description: v.string(),
                points: v.number(),
              }),
            ),
          ),
        }),
      ),
    ),
    procedureSteps: v.array(
      v.object({
        key: v.string(),
        body: v.string(),
        addAsTask: v.boolean(),
        taskId: v.optional(v.id("tasks")),
      }),
    ),
    expectationIds: v.array(v.id("expectations")),
    /**
     * When false, students cannot submit hand-in URLs for this assignment.
     * Omitted/undefined means true (legacy rows).
     */
    acceptLinkSubmissions: v.optional(v.boolean()),
    /** When true, saved scores are visible to students/guardians. */
    scoresReleased: v.optional(v.boolean()),
    /** Optional teacher-uploaded worksheet image (class library, images preset). */
    worksheetImageFileId: v.optional(v.id("files")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_classId", ["classId"])
    .index("by_classId_updatedAt", ["classId", "updatedAt"])
    .index("by_worksheetImageFileId", ["worksheetImageFileId"]),
  /**
   * Student-owned links for an assignment. `handedIn` marks which links are submitted.
   */
  assignmentStudentLinks: defineTable({
    classId: v.id("classes"),
    assignmentId: v.id("assignments"),
    studentUserId: v.id("users"),
    url: v.string(),
    label: v.optional(v.string()),
    handedIn: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_assignment", ["assignmentId"])
    .index("by_assignment_student", ["assignmentId", "studentUserId"])
    .index("by_classId", ["classId"]),
  /**
   * Per-student assignment scores (staff-entered). Visibility gated by assignments.scoresReleased.
   */
  assignmentScores: defineTable({
    classId: v.id("classes"),
    assignmentId: v.id("assignments"),
    studentUserId: v.id("users"),
    /** Present when scoringMode === "total" */
    totalPointsEarned: v.optional(v.number()),
    /** Present when scoringMode === "sections" */
    sectionScores: v.optional(
      v.array(
        v.object({
          sectionKey: v.string(),
          pointsEarned: v.optional(v.number()),
          selectedLevelKey: v.optional(v.string()),
          checkedItemKeys: v.optional(v.array(v.string())),
        }),
      ),
    ),
    /** When true, the student is excused from this assignment. */
    excused: v.optional(v.boolean()),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_assignment", ["assignmentId"])
    .index("by_assignment_student", ["assignmentId", "studentUserId"])
    .index("by_classId", ["classId"]),
  /**
   * Class expectations — teacher-defined numeric (or range) measures with a unit.
   */
  expectations: defineTable({
    classId: v.id("classes"),
    name: v.string(),
    description: v.optional(v.string()),
    inputType: v.union(v.literal("number"), v.literal("numberRange")),
    unit: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_classId", ["classId"])
    .index("by_classId_updatedAt", ["classId", "updatedAt"]),
  /**
   * Sparse per-student expectation values. Missing row = unset.
   * `number` uses numberValue; `numberRange` uses rangeMin + rangeMax.
   */
  expectationValues: defineTable({
    classId: v.id("classes"),
    expectationId: v.id("expectations"),
    studentUserId: v.id("users"),
    numberValue: v.optional(v.number()),
    rangeMin: v.optional(v.number()),
    rangeMax: v.optional(v.number()),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_expectation_student", ["expectationId", "studentUserId"])
    .index("by_expectation", ["expectationId"])
    .index("by_classId", ["classId"])
    .index("by_class_student", ["classId", "studentUserId"]),
  /**
   * Behavior folders — flat containers for behaviors within a class.
   * Separate from reward folders; not a shared cross-feature table.
   */
  behaviorFolders: defineTable({
    classId: v.id("classes"),
    name: v.string(),
    description: v.optional(v.string()),
    /** Font Awesome icon id (`fas:…` / `far:…`), same format as class/group icons. */
    icon: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_classId", ["classId"]),
  /**
   * Behavior catalog entries — point values applied when awarded to students.
   */
  behaviors: defineTable({
    classId: v.id("classes"),
    folderId: v.optional(v.id("behaviorFolders")),
    name: v.string(),
    description: v.optional(v.string()),
    /** Font Awesome icon id (`fas:…` / `far:…`). */
    icon: v.optional(v.string()),
    /** Integer points; may be negative. */
    points: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_classId", ["classId"])
    .index("by_folderId", ["folderId"]),
  /**
   * Per-student behavior awards (ledger). `pointsApplied` is a snapshot at award
   * time so future catalog edits can leave history alone or rewrite it.
   */
  behaviorApplications: defineTable({
    classId: v.id("classes"),
    behaviorId: v.id("behaviors"),
    studentUserId: v.id("users"),
    pointsApplied: v.number(),
    /** Units applied in this ledger row; missing on legacy rows means 1. */
    quantity: v.optional(v.number()),
    awardedBy: v.id("users"),
    awardedAt: v.number(),
    note: v.optional(v.string()),
  })
    .index("by_behaviorId", ["behaviorId"])
    .index("by_classId_student", ["classId", "studentUserId"])
    .index("by_classId_student_awardedAt", ["classId", "studentUserId", "awardedAt"])
    .index("by_classId", ["classId"]),
  /**
   * Reward folders — flat containers for rewards within a class.
   * Separate from behavior folders; not a shared cross-feature table.
   * Optional purchaseLimit is a folder aggregate; item limits supersede it.
   */
  rewardFolders: defineTable({
    classId: v.id("classes"),
    name: v.string(),
    description: v.optional(v.string()),
    /** Font Awesome icon id (`fas:…` / `far:…`), same format as class/group icons. */
    icon: v.optional(v.string()),
    purchaseLimit: v.optional(
      v.object({
        maxPurchases: v.number(),
        type: v.literal("recurring"),
        period: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
        every: v.number(),
      }),
    ),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_classId", ["classId"]),
  /**
   * Reward catalog entries — point cost when redeemed by students.
   */
  rewards: defineTable({
    classId: v.id("classes"),
    folderId: v.optional(v.id("rewardFolders")),
    name: v.string(),
    description: v.optional(v.string()),
    /** Font Awesome icon id (`fas:…` / `far:…`). */
    icon: v.optional(v.string()),
    /** Integer point cost; non-negative. */
    points: v.number(),
    purchaseLimit: v.optional(
      v.object({
        maxPurchases: v.number(),
        type: v.literal("recurring"),
        period: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
        every: v.number(),
      }),
    ),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_classId", ["classId"])
    .index("by_folderId", ["folderId"]),
  /**
   * Per-student reward purchases (ledger). `pointsCost` is a snapshot at purchase
   * time so future catalog edits can leave history alone or rewrite it.
   */
  rewardPurchases: defineTable({
    classId: v.id("classes"),
    rewardId: v.id("rewards"),
    studentUserId: v.id("users"),
    pointsCost: v.number(),
    /** Units purchased in this ledger row; missing on legacy rows means 1. */
    quantity: v.optional(v.number()),
    purchasedBy: v.id("users"),
    purchasedAt: v.number(),
    note: v.optional(v.string()),
  })
    .index("by_rewardId", ["rewardId"])
    .index("by_classId_student", ["classId", "studentUserId"])
    .index("by_classId_student_purchasedAt", ["classId", "studentUserId", "purchasedAt"])
    .index("by_classId", ["classId"]),
  /**
   * Per-student warning events (daily reset via dateKey). Roster warningCount is
   * denormalized for the points grid; this ledger supports undo/clear.
   */
  studentWarningEvents: defineTable({
    classId: v.id("classes"),
    studentUserId: v.id("users"),
    dateKey: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_classId_student_dateKey", ["classId", "studentUserId", "dateKey"])
    .index("by_classId_student_createdAt", ["classId", "studentUserId", "createdAt"])
    .index("by_classId_dateKey", ["classId", "dateKey"]),
  /**
   * Class calendar events — one-off timed, all-day, and multi-day.
   * Timed events store UTC instants plus the event time zone.
   * All-day events store local date keys with exclusive end.
   */
  calendarEvents: defineTable({
    classId: v.id("classes"),
    title: v.string(),
    description: v.optional(v.string()),
    allDay: v.boolean(),
    timezone: v.optional(v.string()),
    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),
    startDateKey: v.optional(v.string()),
    /** Exclusive local end date for all-day events. */
    endDateKey: v.optional(v.string()),
    audienceKind: v.union(v.literal("all"), v.literal("roles")),
    audienceRoles: v.array(v.string()),
    /** Optional; missing on events created before attachments existed. */
    attachmentFileIds: v.optional(v.array(v.id("files"))),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_classId", ["classId"])
    .index("by_classId_startAt", ["classId", "startAt"])
    .index("by_classId_startDateKey", ["classId", "startDateKey"]),
  /**
   * Relative reminders attached to a calendar event.
   * `scheduledFunctionId` + `revision` make cancel/reschedule race-safe.
   */
  calendarEventReminders: defineTable({
    classId: v.id("classes"),
    eventId: v.id("calendarEvents"),
    amount: v.number(),
    unit: v.union(v.literal("minute"), v.literal("hour"), v.literal("day"), v.literal("week")),
    notifyRoles: v.array(v.string()),
    notifyAt: v.number(),
    revision: v.number(),
    status: v.union(
      v.literal("scheduled"),
      v.literal("delivered"),
      v.literal("canceled"),
      v.literal("skipped"),
    ),
    scheduledFunctionId: v.optional(v.id("_scheduled_functions")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_classId", ["classId"]),
  /**
   * Searchable per-user projection of inbox notifications.
   * Source of truth for `/notifications` history; kept in sync with the
   * `convex-notification` component via create hooks and state wrappers.
   */
  notificationHistory: defineTable({
    userId: v.id("users"),
    notificationId: v.string(),
    sequence: v.number(),
    kind: v.string(),
    statusKey: v.union(v.literal("unread"), v.literal("read"), v.literal("dismissed")),
    title: v.string(),
    description: v.optional(v.string()),
    searchText: v.string(),
    classId: v.optional(v.string()),
    className: v.optional(v.string()),
    eventId: v.optional(v.string()),
    href: v.string(),
    isSeen: v.boolean(),
    isDismissed: v.boolean(),
    seenAt: v.optional(v.number()),
    dismissedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_userId_notificationId", ["userId", "notificationId"])
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_userId_statusKey_createdAt", ["userId", "statusKey", "createdAt"])
    .index("by_classId", ["classId"])
    .index("by_eventId", ["eventId"])
    .searchIndex("search_text", {
      searchField: "searchText",
      filterFields: ["userId", "kind", "classId", "statusKey"],
    }),
  /**
   * Browser Web Push subscriptions (one row per endpoint).
   */
  pushSubscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_endpoint", ["endpoint"]),
  /**
   * Per-class FERPA activity log (append-only).
   * Purged on class delete and by retention cron (1 year).
   */
  classActivityEvents: defineTable({
    classId: v.id("classes"),
    actorUserId: v.id("users"),
    actorEmail: v.string(),
    /** Highest class role at event time; omitted on older rows. */
    actorRole: v.optional(v.string()),
    action: v.union(
      v.literal("read"),
      v.literal("write"),
      v.literal("update"),
      v.literal("delete"),
    ),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    summary: v.string(),
    /** i18n key for client-side summary formatting; omitted on older rows. */
    summaryKey: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.string())),
    createdAt: v.number(),
  })
    .index("by_class_createdAt", ["classId", "createdAt"])
    .index("by_class_resource_createdAt", ["classId", "resourceType", "createdAt"])
    .index("by_class_actor_action_resource_createdAt", [
      "classId",
      "actorUserId",
      "action",
      "resourceType",
      "createdAt",
    ])
    .index("by_createdAt", ["createdAt"]),
  /**
   * Anonymous Free-card CTA clicks (cloud prod only). No user/IP fields.
   * Aggregated via @convex-dev/aggregate for range counts.
   */
  anonymousUsageEvents: defineTable({
    kind: v.union(v.literal("desktop_download"), v.literal("self_host_click")),
    os: v.optional(v.union(v.literal("windows"), v.literal("mac"), v.literal("ubuntu"))),
  }),
  /**
   * Daily GitHub Traffic clone counts (CI-adjusted). Synced by cron.
   */
  githubCloneDays: defineTable({
    dayKey: v.string(),
    dayStartMs: v.number(),
    rawCount: v.number(),
    ciSubtracted: v.number(),
    count: v.number(),
    uniques: v.number(),
    syncedAt: v.number(),
  }).index("by_dayKey", ["dayKey"]),
  /**
   * Per-student RAZ reading levels for a class.
   * Sparse — missing row means the student still needs an initial level.
   * `currentLevel` is updated by assessments; `initialLevel` stays fixed after setup.
   */
  razStudentLevels: defineTable({
    classId: v.id("classes"),
    studentUserId: v.id("users"),
    initialLevel: v.string(),
    currentLevel: v.optional(v.string()),
    /** Teacher override; when set, takes priority over schedule-derived status. */
    manualStatus: v.optional(
      v.union(v.literal("rti"), v.literal("pending"), v.literal("ineligible")),
    ),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_class_student", ["classId", "studentUserId"])
    .index("by_classId", ["classId"]),
  /**
   * Recorded RAZ Read / Retell / Respond assessments.
   */
  razAssessments: defineTable({
    classId: v.id("classes"),
    studentUserId: v.id("users"),
    assessedAt: v.number(),
    readAccuracy: v.number(),
    retellScore: v.optional(v.number()),
    respondScore: v.number(),
    result: v.union(v.literal("level_up"), v.literal("stay"), v.literal("level_down")),
    level: v.string(),
    note: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.id("users"),
  })
    .index("by_classId", ["classId"])
    .index("by_class_student", ["classId", "studentUserId"]),
  /**
   * Cloud product feedback (message-in-a-bottle). Not used on self-host / Electron.
   */
  /**
   * Grade scales — shared system defaults (`classId` absent, `systemKey` set) or class-owned copies.
   */
  gradeScales: defineTable({
    /** Absent for shared system defaults (keyed by `systemKey`). */
    classId: v.optional(v.id("classes")),
    systemKey: v.optional(
      v.union(
        v.literal("highRange"),
        v.literal("perfectScore"),
        v.literal("standard"),
        v.literal("letterGrades"),
      ),
    ),
    /** Class-owned scale name. System rows use `nameKey` for i18n instead. */
    name: v.optional(v.string()),
    nameKey: v.optional(v.string()),
    levels: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        minPercent: v.number(),
        maxPercent: v.number(),
      }),
    ),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_classId", ["classId"])
    .index("by_systemKey", ["systemKey"]),
  /** Per-class visibility override for shared system grade scales. */
  gradeScaleHiddenDefaults: defineTable({
    classId: v.id("classes"),
    systemKey: v.union(
      v.literal("highRange"),
      v.literal("perfectScore"),
      v.literal("standard"),
      v.literal("letterGrades"),
    ),
    hiddenBy: v.id("users"),
    hiddenAt: v.number(),
  })
    .index("by_classId", ["classId"])
    .index("by_classId_systemKey", ["classId", "systemKey"]),
  /** Weighted composition of assignment sections for gradebook subjects. */
  gradedSubjects: defineTable({
    classId: v.id("classes"),
    name: v.string(),
    /** Font Awesome icon id (`fas:…` / `far:…`), same format as class/group icons. */
    icon: v.optional(v.string()),
    gradeScaleId: v.id("gradeScales"),
    items: v.array(
      v.object({
        assignmentId: v.id("assignments"),
        sectionKey: v.optional(v.string()),
        weight: v.number(),
      }),
    ),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_classId", ["classId"]),
  /** Fungible-item random assigners (e.g. Chromebooks). */
  randomAssigners: defineTable({
    classId: v.id("classes"),
    name: v.string(),
    items: v.array(v.string()),
    defaultReplicates: v.boolean(),
    defaultScope: v.union(v.literal("class"), v.literal("groups")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_classId", ["classId"]),
  /** Fungible-item equitable assigners (fair experience balancing). */
  equitableAssigners: defineTable({
    classId: v.id("classes"),
    name: v.string(),
    items: v.array(v.string()),
    defaultBalanceGender: v.boolean(),
    defaultScope: v.union(v.literal("class"), v.literal("groups")),
    defaultGenderBuckets: v.optional(
      v.array(v.union(v.literal("m"), v.literal("f"), v.literal("other"), v.literal("unknown"))),
    ),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_classId", ["classId"]),
  /** Immutable snapshots of random assigner runs. */
  randomAssignerRuns: defineTable({
    classId: v.id("classes"),
    assignerId: v.id("randomAssigners"),
    ranAt: v.number(),
    ranBy: v.id("users"),
    scope: v.union(v.literal("class"), v.literal("groups")),
    replicates: v.boolean(),
    itemsSnapshot: v.array(v.string()),
    assignments: v.array(
      v.object({
        studentUserId: v.id("users"),
        studentDisplayName: v.string(),
        item: v.string(),
        rosterNumber: v.optional(v.number()),
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
        groupId: v.optional(v.id("groups")),
        groupName: v.optional(v.string()),
      }),
    ),
  })
    .index("by_classId", ["classId"])
    .index("by_assignerId", ["assignerId"])
    .index("by_assignerId_ranAt", ["assignerId", "ranAt"]),
  /** Immutable snapshots of equitable assigner runs. */
  equitableAssignerRuns: defineTable({
    classId: v.id("classes"),
    assignerId: v.id("equitableAssigners"),
    ranAt: v.number(),
    ranBy: v.id("users"),
    scope: v.union(v.literal("class"), v.literal("groups")),
    balanceGender: v.boolean(),
    genderBuckets: v.optional(
      v.array(v.union(v.literal("m"), v.literal("f"), v.literal("other"), v.literal("unknown"))),
    ),
    itemsSnapshot: v.array(v.string()),
    assignments: v.array(
      v.object({
        studentUserId: v.id("users"),
        studentDisplayName: v.string(),
        item: v.string(),
        rosterNumber: v.optional(v.number()),
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
        groupId: v.optional(v.id("groups")),
        groupName: v.optional(v.string()),
      }),
    ),
  })
    .index("by_classId", ["classId"])
    .index("by_assignerId", ["assignerId"])
    .index("by_assignerId_ranAt", ["assignerId", "ranAt"]),
  /**
   * Timetable terms (quarters, semesters, etc.) — each term owns bell slots.
   */
  timetableTerms: defineTable({
    classId: v.id("classes"),
    name: v.string(),
    kind: v.union(
      v.literal("quarter"),
      v.literal("semester"),
      v.literal("trimester"),
      v.literal("year"),
      v.literal("custom"),
    ),
    startDateKey: v.string(),
    endDateKey: v.string(),
    days: v.array(v.string()),
    startTime: v.string(),
    endTime: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_classId", ["classId"]),
  /** Bell-schedule slots within a term. */
  timetableSlots: defineTable({
    classId: v.id("classes"),
    termId: v.id("timetableTerms"),
    day: v.string(),
    startTime: v.string(),
    endTime: v.string(),
    /** Global disable for the slot (not week-specific). */
    disabled: v.boolean(),
    /** Linked slots mirror lesson content for the same week. */
    linkGroupId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_termId", ["termId"])
    .index("by_classId", ["classId"])
    .index("by_termId_linkGroupId", ["termId", "linkGroupId"]),
  /** Reusable subject catalog (Math, PE, etc.). */
  timetableSubjects: defineTable({
    classId: v.id("classes"),
    name: v.string(),
    bgColor: v.string(),
    textColor: v.string(),
    iconName: v.optional(v.string()),
    /** @deprecated Discarded by timetable section migration. */
    defaultNotesJson: v.optional(v.string()),
    defaultMaterials: v.optional(
      v.array(
        v.object({
          key: v.string(),
          text: v.string(),
          tags: v.array(v.string()),
        }),
      ),
    ),
    defaultAnnouncements: v.optional(
      v.array(
        v.object({
          key: v.string(),
          text: v.string(),
          tags: v.array(v.string()),
        }),
      ),
    ),
    defaultAgenda: v.optional(
      v.array(
        v.object({
          key: v.string(),
          text: v.string(),
          tags: v.array(v.string()),
          assignmentId: v.optional(v.id("assignments")),
          taskId: v.optional(v.id("tasks")),
          preface: v.optional(v.string()),
        }),
      ),
    ),
    calendarAudienceRoles: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_classId", ["classId"]),
  /** Weekly lesson placement in a slot. */
  timetableLessons: defineTable({
    classId: v.id("classes"),
    termId: v.id("timetableTerms"),
    slotId: v.id("timetableSlots"),
    subjectId: v.id("timetableSubjects"),
    year: v.number(),
    weekNumber: v.number(),
    /** @deprecated Discarded by timetable section migration. */
    notesJson: v.optional(v.string()),
    complete: v.boolean(),
    /** @deprecated Migrated into materials/agenda, then cleared. */
    links: v.array(
      v.object({
        key: v.string(),
        kind: v.union(v.literal("url"), v.literal("assignment"), v.literal("task")),
        label: v.optional(v.string()),
        url: v.optional(v.string()),
        assignmentId: v.optional(v.id("assignments")),
        taskId: v.optional(v.id("tasks")),
      }),
    ),
    materials: v.optional(
      v.array(
        v.object({
          key: v.string(),
          text: v.string(),
          tags: v.array(v.string()),
        }),
      ),
    ),
    announcements: v.optional(
      v.array(
        v.object({
          key: v.string(),
          text: v.string(),
          tags: v.array(v.string()),
        }),
      ),
    ),
    agenda: v.optional(
      v.array(
        v.object({
          key: v.string(),
          text: v.string(),
          tags: v.array(v.string()),
          assignmentId: v.optional(v.id("assignments")),
          taskId: v.optional(v.id("tasks")),
          preface: v.optional(v.string()),
        }),
      ),
    ),
    /** Optional slide deck or other lesson page. */
    lessonUrl: v.optional(v.string()),
    /** When true, the classroom screen shows the lesson URL to other class roles. */
    lessonUrlShared: v.optional(v.boolean()),
    resources: v.optional(
      v.array(
        v.object({
          key: v.string(),
          url: v.string(),
          label: v.optional(v.string()),
        }),
      ),
    ),
    /** When true, class members without timetable:manage can see resource links. */
    resourcesShared: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_termId_year_week", ["termId", "year", "weekNumber"])
    .index("by_slotId_year_week", ["slotId", "year", "weekNumber"])
    .index("by_subjectId", ["subjectId"])
    .index("by_classId", ["classId"]),
  /** Per-week slot disable overrides. */
  timetableSlotDisables: defineTable({
    classId: v.id("classes"),
    slotId: v.id("timetableSlots"),
    year: v.number(),
    weekNumber: v.number(),
    createdAt: v.number(),
  })
    .index("by_slotId_year_week", ["slotId", "year", "weekNumber"])
    .index("by_classId", ["classId"]),
  /** Class-wide hashtag dictionary for timetable materials/announcements/agenda. */
  timetableTags: defineTable({
    classId: v.id("classes"),
    tag: v.string(),
    display: v.string(),
    updatedAt: v.number(),
  })
    .index("by_classId", ["classId"])
    .index("by_classId_tag", ["classId", "tag"]),
  /** Per-class classroom screen clock settings (one row per class). */
  classroomClockSettings: defineTable({
    classId: v.id("classes"),
    clockSize: v.number(),
    dateSize: v.number(),
    clockBgColor: v.string(),
    timerBgColor: v.string(),
    dateLocation: v.union(v.literal("above"), v.literal("below")),
    timeFormat: v.union(v.literal("12h"), v.literal("24h")),
    currentTimeSize: v.optional(v.number()),
    endTimeSize: v.optional(v.number()),
    timerTitleSize: v.optional(v.number()),
    timerEndBehavior: v.optional(
      v.union(v.literal("countUp"), v.literal("hold"), v.literal("return")),
    ),
    overtimeAutoDismissSeconds: v.optional(v.number()),
    bgTransition: v.optional(v.string()),
    audioCues: v.optional(v.any()),
    displayContentFontSize: v.optional(v.number()),
    displayHeadingFontSize: v.optional(v.number()),
    displaySectionHeadingFontSize: v.optional(v.number()),
    quickText: v.optional(v.string()),
    quickTextTitle: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_classId", ["classId"]),
  /** Saved classroom timers. */
  classroomTimers: defineTable({
    classId: v.id("classes"),
    name: v.string(),
    durationSeconds: v.number(),
    bgColor: v.string(),
    endTime: v.optional(v.string()),
    bgTransition: v.optional(v.string()),
    audioCues: v.optional(v.any()),
    nextTimerId: v.optional(v.id("classroomTimers")),
    sortOrder: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_classId", ["classId"]),
  /** Saved classroom rotation schedules. */
  classroomRotations: defineTable({
    classId: v.id("classes"),
    name: v.string(),
    rotationDurationSeconds: v.number(),
    numberOfRotations: v.number(),
    transitionDurationSeconds: v.number(),
    rotationBgColor: v.string(),
    transitionBgColor: v.string(),
    finalTransition: v.optional(v.boolean()),
    bgTransition: v.optional(v.string()),
    audioCues: v.optional(v.any()),
    workCues: v.optional(v.any()),
    transitionCues: v.optional(v.any()),
    sortOrder: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_classId", ["classId"]),
  /** Uploaded audio metadata for classroom screen cues. */
  classroomAudioFiles: defineTable({
    classId: v.id("classes"),
    name: v.string(),
    fileId: v.id("files"),
    contentType: v.string(),
    size: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_classId", ["classId"]),
  /** Synced display session state (one row per class). */
  classroomDisplaySessions: defineTable({
    classId: v.id("classes"),
    sessionJson: v.optional(v.any()),
    endsAt: v.optional(v.number()),
    paused: v.boolean(),
    pausedRemainingMs: v.optional(v.number()),
    pushedLessonId: v.optional(v.id("timetableLessons")),
    pushedUntil: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_classId", ["classId"]),
  feedback: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("bug"), v.literal("feature"), v.literal("concern"), v.literal("other")),
    title: v.string(),
    body: v.string(),
    stepsToReproduce: v.optional(v.string()),
    expected: v.optional(v.string()),
    actual: v.optional(v.string()),
    severity: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    useCase: v.optional(v.string()),
    proposedSolution: v.optional(v.string()),
    importance: v.optional(
      v.union(v.literal("nice"), v.literal("important"), v.literal("critical")),
    ),
    impact: v.optional(v.string()),
    wantReply: v.boolean(),
    attachmentFileIds: v.array(v.id("files")),
    createdAt: v.number(),
    archivedAt: v.optional(v.number()),
    /** Demo / seed rows — deletable via clearDemo. */
    isSeed: v.optional(v.boolean()),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_userId", ["userId"])
    .index("by_isSeed", ["isSeed"]),
});

export default schema;
