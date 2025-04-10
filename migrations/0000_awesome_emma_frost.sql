-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `classes` (
	`class_id` text PRIMARY KEY NOT NULL,
	`class_name` text NOT NULL,
	`class_language` text NOT NULL,
	`class_grade` text,
	`class_year` text,
	`class_code` text NOT NULL,
	`complete` text,
	`created_date` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_date` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classes_class_code_unique` ON `classes` (`class_code`);--> statement-breakpoint
CREATE TABLE `teacher_classes` (
	`assignment_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`class_id` text NOT NULL,
	`role` text,
	`assigned_date` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`class_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `classes_by_user_id_idx` ON `teacher_classes` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`user_id` text PRIMARY KEY NOT NULL,
	`user_name` text NOT NULL,
	`user_email` text NOT NULL,
	`user_role` text,
	`added_demo` integer,
	`joined_date` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_date` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_user_email_unique` ON `users` (`user_email`);
*/