import { sqliteTable, uniqueIndex, text, index, integer } from "drizzle-orm/sqlite-core"

export const classes = sqliteTable("classes", {
	classId: text("class_id").primaryKey().notNull(),
	className: text("class_name").notNull(),
	classLanguage: text("class_language").notNull(),
	classGrade: text("class_grade"),
	classYear: text("class_year"),
	classCode: text("class_code").notNull(),
	complete: text(),
	createdDate: text("created_date").default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedDate: text("updated_date").default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	uniqueIndex("classes_class_code_unique").on(table.classCode),
]);

export const teacherClasses = sqliteTable("teacher_classes", {
	assignmentId: text("assignment_id").primaryKey().notNull(),
	userId: text("user_id").notNull().references(() => users.userId),
	classId: text("class_id").notNull().references(() => classes.classId),
	role: text(),
	assignedDate: text("assigned_date").default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("classes_by_user_id_idx").on(table.userId),
]);

export const users = sqliteTable("users", {
	userId: text("user_id").primaryKey().notNull(),
	userName: text("user_name").notNull(),
	userEmail: text("user_email").notNull(),
	userRole: text("user_role"),
	addedDemo: integer("added_demo"),
	joinedDate: text("joined_date").default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedDate: text("updated_date").default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	uniqueIndex("users_user_email_unique").on(table.userEmail),
]);

