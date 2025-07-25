import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  type Grade,
  type AssignerItemStatuses,
  type PointRecord,
  type RedemptionRecord,
} from "./types";

export const users = sqliteTable("users", {
  user_id: text("user_id").notNull().primaryKey(),
  user_name: text("user_name").notNull(),
  user_email: text("user_email").notNull().unique(),
  user_role: text("user_role", { enum: ["teacher", "admin"] }), // All users who sign up will be assigned the teacher role. Will need to manually assign admins.
  added_demo: integer("added_demo", { mode: "boolean" }),
  joined_date: text("joined_date")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updated_date: text("updated_date")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const classes = sqliteTable("classes", {
  class_id: text("class_id").notNull().primaryKey(),
  class_name: text("class_name").notNull(),
  class_language: text("class_language").notNull(),
  class_grade: text("class_grade", { enum: ["1", "2", "3", "4", "5", "6"] }),
  class_year: text("class_year"),
  class_code: text("class_code").unique().notNull(),
  archived: integer("archived", { mode: "boolean" }),
  complete: text("complete", { mode: "json" }).$type<{
    s1: boolean;
    s2: boolean;
  }>(),
  created_date: text("created_date")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updated_date: text("updated_date")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const teacher_classes = sqliteTable(
  "teacher_classes",
  {
    assignment_id: text("assignment_id").notNull().primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    role: text("role", { enum: ["primary", "assistant"] }),
    assigned_date: text("assigned_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      classes_by_user_id_idx: index("classes_by_user_id_idx").on(table.user_id),
    };
  },
);

// Tables for /api/class-by-id

export const students = sqliteTable("students", {
  student_id: text("student_id").notNull().primaryKey(),
  student_name_en: text("student_name_en"),
  student_name_first_en: text("student_name_first_en").notNull(),
  student_name_last_en: text("student_name_last_en").notNull(),
  student_name_alt: text("student_name_alt"),
  student_reading_level: text("student_reading_level"),
  student_grade: text("student_grade"),
  student_sex: text("student_sex", { enum: ["male", "female"] }),
  student_number: integer("student_number", { mode: "number" }),
  student_email: text("student_email"),
  joined_date: text("joined_date")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updated_date: text("updated_date")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const groups = sqliteTable(
  "groups",
  {
    group_id: text("group_id").notNull().primaryKey(),
    group_name: text("group_name").notNull(),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    created_date: text("created_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updated_date: text("updated_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      groups_by_class_id_idx: index("groups_by_class_id_idx").on(
        table.class_id,
      ),
    };
  },
);

export const sub_groups = sqliteTable(
  "sub_groups",
  {
    sub_group_id: text("sub_group_id").notNull().primaryKey(),
    group_id: text("group_id")
      .notNull()
      .references(() => groups.group_id),
    sub_group_name: text("sub_group_name").notNull(),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    created_date: text("created_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updated_date: text("updated_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      sub_groups_by_class_id_idx: index("sub_groups_by_class_id_idx").on(
        table.class_id,
      ),
      sub_groups_by_group_id_idx: index("sub_groups_by_group_id_idx").on(
        table.group_id,
      ),
    };
  },
);

export const reward_items = sqliteTable(
  "reward_items",
  {
    item_id: text("item_id").notNull().primaryKey(),
    class_id: text("class_id").references(() => classes.class_id),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    price: integer("price", { mode: "number" }).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    type: text("type", { enum: ["solo", "group", "class"] }).notNull(),
    title: text("title"),
    created_date: text("created_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updated_date: text("updated_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      reward_items_by_class_id_idx: index("reward_items_by_class_id_idx").on(
        table.class_id,
      ),
      reward_items_by_user_id_idx: index("reward_items_by_user_id_idx").on(
        table.user_id,
      ),
    };
  },
);

export const behaviors = sqliteTable(
  "behaviors",
  {
    behavior_id: text("behavior_id").notNull().primaryKey(),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    name: text("name").notNull(),
    point_value: integer("point_value", { mode: "number" }).notNull(),
    description: text("description"),
    icon: text("icon"),
    color: text("color"),
    title: text("title"),
    created_date: text("created_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updated_date: text("updated_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      behaviors_by_class_id_idx: index("behaviors_by_class_id_idx").on(
        table.class_id,
      ),
      behaviors_by_user_id_idx: index("behaviors_by_user_id_idx").on(
        table.user_id,
      ),
    };
  },
);

export const student_classes = sqliteTable(
  "student_classes",
  {
    enrollment_id: text("enrollment_id").notNull().primaryKey(),
    student_id: text("student_id")
      .notNull()
      .references(() => students.student_id),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    enrollment_date: text("enrollment_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    points: integer("points", { mode: "number" }),
    redemption_points: integer("redemption_points", { mode: "number" }),
    first: integer("first", { mode: "boolean" }).default(false),
    last: integer("last", { mode: "boolean" }).default(false),
    first_count: integer("first_count").notNull().default(0),
    last_count: integer("last_count").notNull().default(0),
    minus_points: integer("minus_points", { mode: "number" }),
    point_history: text("point_history", { mode: "json" }).$type<
      PointRecord[]
    >(),
    redemption_history: text("redemption_history", { mode: "json" }).$type<
      RedemptionRecord[]
    >(),
    absent_dates: text("absent_dates", { mode: "json" }).$type<string[]>(),
  },
  (table) => {
    return {
      students_by_class_id_idx: index("students_by_class_id_idx").on(
        table.class_id,
      ),
    };
  },
);

export const student_groups = sqliteTable(
  "student_groups",
  {
    enrollment_id: text("enrollment_id").notNull().primaryKey(),
    group_id: text("group_id")
      .notNull()
      .references(() => groups.group_id),
    student_id: text("student_id")
      .notNull()
      .references(() => students.student_id),
    enrollment_date: text("enrollment_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      groups_by_student_id_idx: index("groups_by_student_id_idx").on(
        table.student_id,
      ),
    };
  },
);

export const student_sub_groups = sqliteTable(
  "student_sub_groups",
  {
    enrollment_id: text("enrollment_id").notNull().primaryKey(),
    sub_group_id: text("sub_group_id")
      .notNull()
      .references(() => sub_groups.sub_group_id),
    student_id: text("student_id")
      .notNull()
      .references(() => students.student_id),
    enrollment_date: text("enrollment_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      sub_groups_by_student_id_idx: index("sub_groups_by_student_id_idx").on(
        table.student_id,
      ),
    };
  },
);

export const absent_dates = sqliteTable(
  "absent_dates",
  {
    id: text("id").notNull().primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    student_id: text("student_id")
      .notNull()
      .references(() => students.student_id),
    date: text("date").notNull(), // YYYY-MM-DD which is handled client side to ensure it adheres to the local time zone
    created_date: text("created_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updated_date: text("updated_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      absent_dates_by_class_id_idx: index("absent_dates_by_class_id_idx").on(
        table.class_id,
      ),
      absent_dates_by_student_id_idx: index(
        "absent_dates_by_student_id_idx",
      ).on(table.student_id),
      absent_dates_by_user_id_idx: index("absent_dates_by_user_id_idx").on(
        table.user_id,
      ),
    };
  },
);

export const points = sqliteTable(
  "points",
  {
    id: text("id").notNull().primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    student_id: text("student_id")
      .notNull()
      .references(() => students.student_id),
    behavior_id: text("behavior_id").references(() => behaviors.behavior_id),
    reward_item_id: text("reward_item_id").references(
      () => reward_items.item_id,
    ),
    type: text("type", {
      enum: ["positive", "negative", "redemption"],
    }).notNull(),
    number_of_points: integer("number_of_points").notNull(),
    created_date: text("created_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updated_date: text("updated_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      points_by_class_id_idx: index("points_by_class_id_idx").on(
        table.class_id,
      ),
      points_by_student_id_idx: index("points_by_student_id_idx").on(
        table.student_id,
      ),
      points_by_user_id_idx: index("points_by_user_id_idx").on(table.user_id),
    };
  },
);

export const raz = sqliteTable(
  "raz",
  {
    id: text("id").notNull().primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    student_id: text("student_id")
      .notNull()
      .references(() => students.student_id),
    result: text("result", {
      enum: ["level up", "stay", "level down"],
    }).notNull(),
    level: text("level").notNull(),
    accuracy: integer("accuracy", { mode: "number" }),
    quiz_score: integer("quiz_score", { mode: "number" }),
    retelling_score: integer("retelling_score", { mode: "number" }),
    note: text("note"),
    date: text("date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updated_date: text("updated_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      raz_by_class_id_idx: index("raz_by_class_id_idx").on(table.class_id),
      raz_by_student_id_idx: index("raz_by_student_id_idx").on(
        table.student_id,
      ),
      raz_by_user_id_idx: index("raz_by_user_id_idx").on(table.user_id),
    };
  },
);

// prod: class_2bc9b0d1-e043-4c50-9fe3-17ba06e26bf3
// dev: class_baeac0da-8fe6-4f3d-b968-8488fee902a8

export const student_assignments = sqliteTable(
  "student_assignments",
  {
    id: text("id").notNull().primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    student_id: text("student_id")
      .notNull()
      .references(() => students.student_id),
    assignment_id: text("assignment_id")
      .notNull()
      .references(() => assignments.id),
    complete: integer("complete", { mode: "boolean" }),
    excused: integer("excused", { mode: "boolean" }),
    completed_ts: text("completed_ts"),
  },
  (table) => {
    return {
      student_assignments_user_id_idx: index(
        "student_assignments_user_id_idx",
      ).on(table.user_id),
      student_assignments_class_id_idx: index(
        "student_assignments_class_id_idx",
      ).on(table.class_id),
      student_assignments_student_id_idx: index(
        "student_assignments_student_id_idx",
      ).on(table.student_id),
      student_assignments_assignment_id_idx: index(
        "student_assignments_assignment_id_idx",
      ).on(table.assignment_id),
    };
  },
);

export const assignments = sqliteTable(
  "assignments",
  {
    id: text("id").notNull().primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    name: text("name").notNull(),
    description: text("description"),
    data: text("data"),
    due_date: text("due_date"),
    topic: text("topic").references(() => topics.id),
    working_date: text("working_date"),
    created_date: text("created_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updated_date: text("updated_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      assignments_by_class_id_idx: index("assignments_by_class_id_idx").on(
        table.class_id,
      ),
      assignments_by_user_id_idx: index("assignments_by_user_id_idx").on(
        table.user_id,
      ),
    };
  },
);

export const topics = sqliteTable(
  "topics",
  {
    id: text("id").notNull().primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    name: text("name").notNull(),
    created_date: text("created_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updated_date: text("updated_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      topics_by_class_id_idx: index("topics_by_class_id_idx").on(
        table.class_id,
      ),
      topics_by_user_id_idx: index("topics_by_user_id_idx").on(table.user_id),
    };
  },
);

export const expectations = sqliteTable(
  "expectations",
  {
    id: text("id").notNull().primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    name: text("name").notNull(),
    description: text("description"),
    created_date: text("created_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updated_date: text("updated_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      expectations_by_class_id_idx: index("expectations_by_class_id_idx").on(
        table.class_id,
      ),
      expectations_by_user_id_idx: index("expectations_by_user_id_idx").on(
        table.user_id,
      ),
    };
  },
);

export const student_expectations = sqliteTable(
  "student_expectations",
  {
    id: text("id").notNull().primaryKey(),
    expectation_id: text("expectation_id")
      .notNull()
      .references(() => expectations.id),
    student_id: text("student_id")
      .notNull()
      .references(() => students.student_id),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    value: text("value"), // This or the below must not be null
    number: integer("number"), // This or the above must not be null
    created_date: text("created_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updated_date: text("updated_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      student_expectations_by_class_id_idx: index(
        "student_expectations_by_class_id_idx",
      ).on(table.class_id),
      student_expectations_by_user_id_idx: index(
        "student_expectations_by_user_id_idx",
      ).on(table.user_id),
      student_expectations_by_student_id_idx: index(
        "student_expectations_by_student_id_idx",
      ).on(table.student_id),
    };
  },
);

export const achievements = sqliteTable(
  "achievements",
  {
    id: text("id").notNull().primaryKey(),
    behavior_id: text("behavior_id").references(() => behaviors.behavior_id),
    reward_item_id: text("reward_item_id").references(
      () => reward_items.item_id,
    ),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    threshold: integer("threshold").notNull(),
    name: text("name").notNull(),
    created_date: text("created_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updated_date: text("updated_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    behaviorIdIdx: index("idx_achievements_behavior_id").on(table.behavior_id),
    classIdIdx: index("idx_achievements_class_id").on(table.class_id),
    userIdIdx: index("idx_achievements_user_id").on(table.user_id),
  }),
);

export const assigners = sqliteTable(
  "assigners",
  {
    assigner_id: text("assigner_id").notNull().primaryKey(),
    name: text("name").notNull(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    assigner_type: text("assigner_type", {
      enum: ["random", "round-robin", "seats"],
    }),
    groups: text("groups", { mode: "json" }).$type<
      { name: string; items: string[] }[]
    >(),
    items: text("items", { mode: "json" }),
    student_item_status: text("student_item_status", {
      mode: "json",
    }).$type<AssignerItemStatuses>(),
    created_date: text("created_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updated_date: text("updated_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      assigner_by_user_id_idx: index("assigner_by_user_id_idx").on(
        table.user_id,
      ),
    };
  },
);

export const graded_assignments = sqliteTable(
  "graded_assignments",
  {
    id: text("id").notNull().primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    name: text("name").notNull(),
    total_points: integer("total_points"),
    created_date: text("created_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updated_date: text("updated_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      graded_assignments_by_class_id_idx: index(
        "graded_assignments_by_class_id_idx",
      ).on(table.class_id),
      graded_assignments_by_user_id_idx: index(
        "graded_assignments_by_user_id_idx",
      ).on(table.user_id),
    };
  },
);

export const assignment_sections = sqliteTable("assignment_sections", {
  id: text("id").notNull().primaryKey(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.user_id),
  class_id: text("class_id")
    .notNull()
    .references(() => classes.class_id),
  graded_assignment_id: text("graded_assignment_id")
    .notNull()
    .references(() => graded_assignments.id),
  name: text("name").notNull(),
  points: integer("points").notNull(),
});

export const assignment_scores = sqliteTable(
  "assignment_scores",
  {
    id: text("id").notNull().primaryKey(),
    student_id: text("student_id")
      .notNull()
      .references(() => students.student_id),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    graded_assignment_id: text("graded_assignment_id")
      .notNull()
      .references(() => graded_assignments.id),
    section_id: text("section_id").references(() => assignment_sections.id),
    score: integer("score"),
    excused: integer("excused", { mode: "boolean" }),
  },
  (table) => {
    return {
      assignment_scores_by_student_id_idx: index(
        "assignment_scores_by_student_id_idx",
      ).on(table.student_id),
      assignment_scores_by_user_id_idx: index(
        "assignment_scores_by_user_id_idx",
      ).on(table.user_id),
      assignment_scores_by_class_id_idx: index(
        "assignment_scores_by_class_id_idx",
      ).on(table.class_id),
      assignment_scores_by_graded_assignment_id_idx: index(
        "assignment_scores_by_graded_assignment_id_idx",
      ).on(table.graded_assignment_id),
      assignment_scores_by_section_id_idx: index(
        "assignment_scores_by_section_id_idx",
      ).on(table.section_id),
    };
  },
);

export const graded_subjects = sqliteTable(
  "graded_subjects",
  {
    id: text("id").notNull().primaryKey(),
    name: text("name").notNull(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    graded_assignment_ids: text("graded_assignment_ids", { mode: "json" })
      .$type<string[]>()
      .default(sql`'[]'`),
    section_ids: text("section_ids", { mode: "json" })
      .$type<string[]>()
      .default(sql`'[]'`),
    default_grade_scale: text("default_grade_scale").references(
      () => grade_scales.id,
    ), // this is the default, but can be changed when exporting grades
  },
  (table) => ({
    graded_subjects_user_id_idx: index("graded_subjects_user_id_idx").on(
      table.user_id,
    ),
    graded_subjects_class_id_idx: index("graded_subjects_class_id_idx").on(
      table.class_id,
    ),
  }),
);

export const grade_scales = sqliteTable(
  "grade_scales",
  {
    id: text("id").notNull().primaryKey(),
    name: text("name").notNull(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    grades: text("grades", { mode: "json" })
      .notNull()
      .$type<Grade[]>()
      .default(sql`'[]'`),
  },
  (table) => ({
    grade_scales_user_id_idx: index("grade_scales_user_id_idx").on(
      table.user_id,
    ),
  }),
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").notNull().primaryKey(),
    name: text("name").notNull(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    graded_subjects: text("graded_subjects", { mode: "json" })
      .$type<string[]>()
      .default(sql`'[]'`),
  },
  (table) => ({
    reports_user_id_idx: index("reports_user_id_idx").on(table.user_id),
    reports_class_id_idx: index("reports_class_id_idx").on(table.class_id),
  }),
);

export type CenturySkillAchievement = "AB" | "CD" | "P" | "NY"; // absent, consistently demonstrates, progressing, not yet

export const century_skills = sqliteTable(
  "century_skills",
  {
    id: text("id").notNull().primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    report_id: text("report_id")
      .notNull()
      .references(() => reports.id),
    student_id: text("student_id")
      .notNull()
      .references(() => students.student_id),
    responsibility: text("responsibility").$type<CenturySkillAchievement>(),
    organization: text("organization").$type<CenturySkillAchievement>(),
    collaboration: text("collaboration").$type<CenturySkillAchievement>(),
    communication: text("communication").$type<CenturySkillAchievement>(),
    thinking: text("thinking").$type<CenturySkillAchievement>(),
    inquiry: text("inquiry").$type<CenturySkillAchievement>(),
    risk_taking: text("risk_taking").$type<CenturySkillAchievement>(),
    open_minded: text("open_minded").$type<CenturySkillAchievement>(),
  },
  (table) => ({
    century_skill_user_id_idx: index("century_skill_user_id_idx").on(
      table.user_id,
    ),
    century_skills_report_id_idx: index("century_skills_report_id_idx").on(
      table.report_id,
    ),
  }),
);

export type CenturySkill = typeof century_skills.$inferSelect;
export type NewCenturySkill = typeof century_skills.$inferInsert;

export const subject_comments = sqliteTable(
  "subject_comments",
  {
    id: text("id").notNull().primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    report_id: text("report_id")
      .notNull()
      .references(() => reports.id),
    comments: text("comments").notNull(),
    created_date: text("created_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updated_date: text("updated_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    subject_comments_user_id_idx: index("subject_comments_user_id_idx").on(
      table.user_id,
    ),
    subject_comments_report_id_idx: index("subject_comments_report_id_idx").on(
      table.report_id,
    ),
  }),
);

export type SubjectComment = typeof subject_comments.$inferSelect;
export type NewSubjectComment = typeof subject_comments.$inferInsert;

export const random_events = sqliteTable(
  "random_events",
  {
    id: text("id").notNull().primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    name: text("name").notNull(),
    description: text("description"),
    image: text("image"),
    audio: text("audio"),
    icon: text("icon"),
    selected: integer("selected", { mode: "boolean" }).notNull().default(false),
    old_files: text("old_files", { mode: "json" })
      .$type<string[]>()
      .default(sql`'[]'`),
    created_date: text("created_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updated_date: text("updated_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    random_events_user_id_idx: index("random_events_user_id_idx").on(
      table.user_id,
    ),
    random_events_class_id_idx: index("random_events_class_id_idx").on(
      table.class_id,
    ),
  }),
);

export type RandomEvent = typeof random_events.$inferSelect;
export type NewRandomEvent = typeof random_events.$inferSelect;

export const randomizations = sqliteTable(
  "randomizations",
  {
    id: text("id").notNull().primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    name: text("name").notNull(),
    created_date: text("created_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updated_date: text("updated_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    randomizations_user_id_idx: index("randomizations_user_id_idx").on(
      table.user_id,
    ),
    randomizations_class_id_idx: index("randomizations_class_id_idx").on(
      table.class_id,
    ),
  }),
);

export type Randomization = typeof randomizations.$inferSelect;
export type NewRandomization = typeof randomizations.$inferInsert;

export const randomizations_students = sqliteTable(
  "randomizations_students",
  {
    id: text("id").notNull().primaryKey(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.user_id),
    class_id: text("class_id")
      .notNull()
      .references(() => classes.class_id),
    student_id: text("student_id")
      .notNull()
      .references(() => students.student_id),
    randomization_id: text("randomization_id")
      .notNull()
      .references(() => randomizations.id),
    checked: integer("checked", { mode: "boolean" }).notNull().default(false),
    position: integer("position").notNull(),
    created_date: text("created_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updated_date: text("updated_date")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    randomizations_students_user_id_idx: index(
      "randomizations_students_user_id_idx",
    ).on(table.user_id),
    randomizations_students_class_id_idx: index(
      "randomizations_students_class_id_idx",
    ).on(table.class_id),
    randomizations_students_randomization_id_idx: index(
      "randomizations_students_randomization_id_idx",
    ).on(table.randomization_id),
  }),
);

export type RandomizationStudent = typeof randomizations_students.$inferSelect;
export type NewRandomizationStudent =
  typeof randomizations_students.$inferInsert;

export type RandomizationWithStudents = Randomization & {
  students: RandomizationStudent[];
};
