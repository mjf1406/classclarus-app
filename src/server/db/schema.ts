import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { PointRecord, RedemptionRecord } from "./types";

export const users = sqliteTable('users',
  {
      user_id: text('user_id').notNull().primaryKey(),
      user_name: text('user_name').notNull(),
      user_email: text('user_email').notNull().unique(),
      user_role: text('user_role', { enum: ["teacher","admin"] }), // All users who sign up will be assigned the teacher role. Will need to manually assign admins.
      added_demo: integer('added_demo', { mode: 'boolean' }),
      joined_date: text('joined_date').default(sql`CURRENT_TIMESTAMP`).notNull(), 
      updated_date: text('updated_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
  }
)

export const classes = sqliteTable('classes',
  {
      class_id: text('class_id').notNull().primaryKey(),
      class_name: text('class_name').notNull(),
      class_language: text('class_language').notNull(),
      class_grade: text('class_grade', { enum: ["1","2","3","4","5", "6"] }),
      class_year: text('class_year'),
      class_code: text('class_code').unique().notNull(),
      complete: text('complete', { mode: 'json' }).$type<{ s1: boolean, s2: boolean }>(),
      created_date: text('created_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
      updated_date: text('updated_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
  }
)

export const teacher_classes = sqliteTable('teacher_classes',
  {
      assignment_id: text('assignment_id').notNull().primaryKey(),
      user_id: text('user_id').notNull().references(() => users.user_id),
      class_id: text('class_id').notNull().references(() => classes.class_id),
      role: text('role', { enum: ["primary", "assistant"] }),
      assigned_date: text('assigned_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
  }, 
  (table) => {
      return {
          classes_by_user_id_idx: index("classes_by_user_id_idx").on(table.user_id)
      }
  }
)

// Tables for /api/class-by-id

export const students = sqliteTable('students',
  {
      student_id: text('student_id').notNull().primaryKey(),
      student_name_en: text('student_name_en'),
      student_name_first_en: text('student_name_first_en').notNull(),
      student_name_last_en: text('student_name_last_en').notNull(),
      student_name_alt: text('student_name_alt'),
      student_reading_level: text('student_reading_level'),
      student_grade: text('student_grade'),
      student_sex: text('student_sex', { enum: ["male", "female"] }),
      student_number: integer('student_number', { mode: 'number' }),
      student_email: text('student_email'),
      joined_date: text('joined_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
      updated_date: text('updated_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
  }
)

export const groups = sqliteTable('groups',
  {
      group_id: text('group_id').notNull().primaryKey(),
      group_name: text('group_name').notNull(),
      class_id: text('class_id').notNull().references(() => classes.class_id),
      created_date: text('created_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
      updated_date: text('updated_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
  }, 
  (table) => {
      return {
          groups_by_class_id_idx: index("groups_by_class_id_idx").on(table.class_id),
      }
  }
)

export const sub_groups = sqliteTable('sub_groups',
  {
      sub_group_id: text('sub_group_id').notNull().primaryKey(),
      group_id: text('group_id').notNull().references(() => groups.group_id),
      sub_group_name: text('sub_group_name').notNull(),
      class_id: text('class_id').notNull().references(() => classes.class_id),
      created_date: text('created_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
      updated_date: text('updated_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
  }, 
  (table) => {
      return {
          sub_groups_by_class_id_idx: index("sub_groups_by_class_id_idx").on(table.class_id),
          sub_groups_by_group_id_idx: index("sub_groups_by_group_id_idx").on(table.group_id),
      }
  }
)

export const reward_items = sqliteTable('reward_items',
  {
      item_id: text('item_id').notNull().primaryKey(),
      class_id: text('class_id').references(() => classes.class_id),
      user_id: text('user_id').notNull().references(() => users.user_id),
      price: integer('price', { mode: 'number' }).notNull(),
      name: text('name').notNull(),
      description: text('description'),
      icon: text('icon'),
      type: text('type', { enum: ["solo", "group", "class"] }).notNull(),
      title: text('title'),
      created_date: text('created_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
      updated_date: text('updated_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => {
    return {
      reward_items_by_class_id_idx: index("reward_items_by_class_id_idx").on( table.class_id),
      reward_items_by_user_id_idx: index("reward_items_by_user_id_idx").on( table.user_id),
    };
  }
)

export const behaviors = sqliteTable('behaviors', 
  {
      behavior_id: text('behavior_id').notNull().primaryKey(),
      class_id: text('class_id').notNull().references(() => classes.class_id),
      user_id: text('user_id').notNull().references(() => users.user_id),
      name: text('name').notNull(),
      point_value: integer('point_value', { mode: 'number' }).notNull(),
      description: text('description'),
      icon: text('icon'),
      color: text('color'),
      title: text('title'),
      created_date: text('created_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
      updated_date: text('updated_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => {
    return {
      behaviors_by_class_id_idx: index("behaviors_by_class_id_idx").on( table.class_id),
      behaviors_by_user_id_idx: index("behaviors_by_user_id_idx").on( table.user_id),
    };
  }
)

export const student_classes = sqliteTable('student_classes',
  {
      enrollment_id: text('enrollment_id').notNull().primaryKey(),
      student_id: text('student_id').notNull().references(() => students.student_id),
      class_id: text('class_id').notNull().references(() => classes.class_id),
      enrollment_date: text('enrollment_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
      points: integer('points', { mode: 'number' }),
      redemption_points: integer('redemption_points', { mode: 'number' }),
      minus_points: integer('minus_points', { mode: 'number' }),
      point_history: text('point_history', { mode: 'json' }).$type<PointRecord[]>(),
      redemption_history: text('redemption_history', { mode: 'json' }).$type<RedemptionRecord[]>(),
      absent_dates: text('absent_dates', { mode: 'json' }).$type<string[]>(),
  }, 
  (table) => {
      return {
          students_by_class_id_idx: index("students_by_class_id_idx").on(table.class_id)
      }
  }
)

export const student_groups = sqliteTable('student_groups',
  {
      enrollment_id: text('enrollment_id').notNull().primaryKey(),
      group_id: text('group_id').notNull().references(() => groups.group_id),
      student_id: text('student_id').notNull().references(() => students.student_id),
      enrollment_date: text('enrollment_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
  }, 
  (table) => {
      return {
          groups_by_student_id_idx: index("groups_by_student_id_idx").on(table.student_id)
      }
  }
)

export const student_sub_groups = sqliteTable('student_sub_groups',
  {
      enrollment_id: text('enrollment_id').notNull().primaryKey(),
      sub_group_id: text('sub_group_id').notNull().references(() => sub_groups.sub_group_id),
      student_id: text('student_id').notNull().references(() => students.student_id),
      enrollment_date: text('enrollment_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
  }, 
  (table) => {
      return {
          sub_groups_by_student_id_idx: index("sub_groups_by_student_id_idx").on(table.student_id)
      }
  }
)

export const absent_dates = sqliteTable('absent_dates',
  {
      id: text('id').notNull().primaryKey(),
      user_id: text('user_id').notNull().references(() => users.user_id),
      class_id: text('class_id').notNull().references(() => classes.class_id),
      student_id: text('student_id').notNull().references(() => students.student_id),
      date: text('date').notNull(), // YYYY-MM-DD which is handled client side to ensure it adheres to the local time zone
      created_date: text('created_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
      updated_date: text('updated_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => {
      return {
          absent_dates_by_class_id_idx: index("absent_dates_by_class_id_idx").on(table.class_id),
          absent_dates_by_student_id_idx: index("absent_dates_by_student_id_idx").on(table.student_id),
          absent_dates_by_user_id_idx: index("absent_dates_by_user_id_idx").on(table.user_id)
      }
  }
)

export const points = sqliteTable('points',
  {
      id: text('id').notNull().primaryKey(),
      user_id: text('user_id').notNull().references(() => users.user_id),
      class_id: text('class_id').notNull().references(() => classes.class_id),
      student_id: text('student_id').notNull().references(() => students.student_id),
      behavior_id: text('behavior_id').references(() => behaviors.behavior_id),
      reward_item_id: text('reward_item_id').references(() => reward_items.item_id),
      type: text('type', { enum: ["positive", "negative", "redemption"] }).notNull(),
      number_of_points: integer('number_of_points').notNull(),
      created_date: text('created_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
      updated_date: text('updated_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => {
      return {
          points_by_class_id_idx: index("points_by_class_id_idx").on(table.class_id),
          points_by_student_id_idx: index("points_by_student_id_idx").on(table.student_id),
          points_by_user_id_idx: index("points_by_user_id_idx").on(table.user_id)
      }
  }
)

export const raz = sqliteTable('raz', 
  {
    id: text('id').notNull().primaryKey(),
    user_id: text('user_id').notNull().references(() => users.user_id),
    class_id: text('class_id').notNull().references(() => classes.class_id),
    student_id: text('student_id').notNull().references(() => students.student_id),
    result: text('result', { enum: ["level up", "stay", "level down"] }).notNull(),
    level: text('level').notNull(),
    accuracy: integer('accuracy', { mode: 'number' }),
    quiz_score: integer('quiz_score', { mode: 'number' }),
    retelling_score: integer('retelling_score', { mode: 'number' }),
    note: text('note'),
    date: text('date').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_date: text('updated_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => {
      return {
          raz_by_class_id_idx: index("raz_by_class_id_idx").on(table.class_id),
          raz_by_student_id_idx: index("raz_by_student_id_idx").on(table.student_id),
          raz_by_user_id_idx: index("raz_by_user_id_idx").on(table.user_id)
      }
  }
)

// prod: class_2bc9b0d1-e043-4c50-9fe3-17ba06e26bf3
// dev: class_baeac0da-8fe6-4f3d-b968-8488fee902a8