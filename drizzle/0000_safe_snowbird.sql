CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`resource` text NOT NULL,
	`resource_id` text,
	`ip_address` text,
	`user_agent` text,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `audit_logs_user_id_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `audit_logs_resource_idx` ON `audit_logs` (`resource`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `case_stats_daily` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`total_received` integer DEFAULT 0 NOT NULL,
	`total_closed` integer DEFAULT 0 NOT NULL,
	`total_rejected` integer DEFAULT 0 NOT NULL,
	`total_in_progress` integer DEFAULT 0 NOT NULL,
	`avg_resolution_days` integer,
	`by_department` text,
	`by_category` text,
	`metadata` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `case_stats_daily_date_unique` ON `case_stats_daily` (`date`);--> statement-breakpoint
CREATE INDEX `case_stats_daily_date_idx` ON `case_stats_daily` (`date`);--> statement-breakpoint
CREATE TABLE `case_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`case_id` text NOT NULL,
	`user_id` text NOT NULL,
	`update_type` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`comment` text,
	`attachments` text,
	`is_public` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `case_updates_case_id_idx` ON `case_updates` (`case_id`);--> statement-breakpoint
CREATE INDEX `case_updates_user_id_idx` ON `case_updates` (`user_id`);--> statement-breakpoint
CREATE INDEX `case_updates_created_at_idx` ON `case_updates` (`created_at`);--> statement-breakpoint
CREATE TABLE `cases` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`location` text NOT NULL,
	`category_id` text NOT NULL,
	`submitted_by` text NOT NULL,
	`assigned_to` text,
	`department_id` text,
	`due_date` integer,
	`closed_at` integer,
	`attachments` text,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `cases_status_idx` ON `cases` (`status`);--> statement-breakpoint
CREATE INDEX `cases_submitted_by_idx` ON `cases` (`submitted_by`);--> statement-breakpoint
CREATE INDEX `cases_assigned_to_idx` ON `cases` (`assigned_to`);--> statement-breakpoint
CREATE INDEX `cases_category_id_idx` ON `cases` (`category_id`);--> statement-breakpoint
CREATE INDEX `cases_department_id_idx` ON `cases` (`department_id`);--> statement-breakpoint
CREATE INDEX `cases_created_at_idx` ON `cases` (`created_at`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`icon` text,
	`default_department_id` text,
	`estimated_days` integer DEFAULT 7,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE INDEX `categories_slug_idx` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `consent_records` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`user_id` text NOT NULL,
	`consent_type` text NOT NULL,
	`version` text NOT NULL,
	`is_granted` integer NOT NULL,
	`granted_at` integer,
	`revoked_at` integer,
	`ip_address` text,
	`user_agent` text,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `consent_records_user_id_idx` ON `consent_records` (`user_id`);--> statement-breakpoint
CREATE INDEX `consent_records_consent_type_idx` ON `consent_records` (`consent_type`);--> statement-breakpoint
CREATE TABLE `dedup_hashes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`hash` text NOT NULL,
	`case_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dedup_hashes_hash_unique` ON `dedup_hashes` (`hash`);--> statement-breakpoint
CREATE INDEX `dedup_hashes_hash_idx` ON `dedup_hashes` (`hash`);--> statement-breakpoint
CREATE INDEX `dedup_hashes_expires_at_idx` ON `dedup_hashes` (`expires_at`);--> statement-breakpoint
CREATE TABLE `departments` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`color` text,
	`icon` text,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `departments_name_unique` ON `departments` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `departments_slug_unique` ON `departments` (`slug`);--> statement-breakpoint
CREATE INDEX `departments_slug_idx` ON `departments` (`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`department_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`full_name` text NOT NULL,
	`phone_number` text,
	`metadata` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `users_department_id_idx` ON `users` (`department_id`);