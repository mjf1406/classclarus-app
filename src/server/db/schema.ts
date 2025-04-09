// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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