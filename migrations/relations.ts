import { relations } from "drizzle-orm/relations";
import { classes, teacherClasses, users } from "./schema";

export const teacherClassesRelations = relations(teacherClasses, ({one}) => ({
	class: one(classes, {
		fields: [teacherClasses.classId],
		references: [classes.classId]
	}),
	user: one(users, {
		fields: [teacherClasses.userId],
		references: [users.userId]
	}),
}));

export const classesRelations = relations(classes, ({many}) => ({
	teacherClasses: many(teacherClasses),
}));

export const usersRelations = relations(users, ({many}) => ({
	teacherClasses: many(teacherClasses),
}));