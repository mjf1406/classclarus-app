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
     * How roster first/last names are combined for display.
     * Defaults to firstLast + space when unset (pre-backfill rows).
     */
    rosterNameOrder: v.optional(v.union(v.literal("firstLast"), v.literal("lastFirst"))),
    rosterNameSpace: v.optional(v.boolean()),
    /**
     * Lookback for the points-board warning badge (default 1 day).
     * Amount × unit (day / week×7 / month×30) ending on the board dateKey.
     */
    warningWindowAmount: v.optional(v.number()),
    warningWindowUnit: v.optional(v.union(v.literal("day"), v.literal("week"), v.literal("month"))),
    /**
     * Lookback for the points-board minus (red flag) badge (default 1 day).
     */
    minusWindowAmount: v.optional(v.number()),
    minusWindowUnit: v.optional(v.union(v.literal("day"), v.literal("week"), v.literal("month"))),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  }).index("by_owner", ["ownerId"]),
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
  })
    .index("by_code", ["code"])
    .index("by_class", ["classId"])
    .index("by_creator", ["createdBy"]),
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
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_classId", ["classId"])
    .index("by_classId_updatedAt", ["classId", "updatedAt"])
    .index("by_assignmentId", ["assignmentId"]),
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
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_classId", ["classId"])
    .index("by_classId_updatedAt", ["classId", "updatedAt"]),
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
   * Cloud product feedback (message-in-a-bottle). Not used on self-host / Electron.
   */
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
