CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace_id` text NOT NULL,
	`name` text NOT NULL,
	`scope` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`namespace_id`) REFERENCES `namespaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tokens_ns_scope_idx` ON `api_tokens` (`namespace_id`,`scope`);--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace_id` text NOT NULL,
	`key` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`namespace_id`) REFERENCES `namespaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entries_ns_key_idx` ON `entries` (`namespace_id`,`key`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`namespace_id`) REFERENCES `namespaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_ns_user_idx` ON `memberships` (`namespace_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `memberships_user_idx` ON `memberships` (`user_id`);--> statement-breakpoint
CREATE TABLE `namespaces` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`default_locale` text DEFAULT 'zh-cn' NOT NULL,
	`locales` text NOT NULL,
	`public_read` integer DEFAULT false NOT NULL,
	`bundle_version` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `namespaces_slug_unique` ON `namespaces` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `namespaces_slug_idx` ON `namespaces` (`slug`);--> statement-breakpoint
CREATE TABLE `translation_task_items` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`key` text NOT NULL,
	`source_value` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `translation_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_items_task_entry_idx` ON `translation_task_items` (`task_id`,`entry_id`);--> statement-breakpoint
CREATE INDEX `task_items_task_status_idx` ON `translation_task_items` (`task_id`,`status`);--> statement-breakpoint
CREATE TABLE `translation_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace_id` text NOT NULL,
	`status` text NOT NULL,
	`target_locales` text NOT NULL,
	`filter` text NOT NULL,
	`source_locale` text NOT NULL,
	`total` integer NOT NULL,
	`done` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`worker_id` text,
	`started_at` integer,
	`completed_at` integer,
	`failed_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`namespace_id`) REFERENCES `namespaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tasks_ns_status_idx` ON `translation_tasks` (`namespace_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `translation_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`locale` text NOT NULL,
	`version` integer NOT NULL,
	`value` text NOT NULL,
	`source` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`actor_id` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`published_at` integer,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tv_entry_locale_version_idx` ON `translation_versions` (`entry_id`,`locale`,`version`);--> statement-breakpoint
CREATE INDEX `tv_entry_locale_status_idx` ON `translation_versions` (`entry_id`,`locale`,`status`);--> statement-breakpoint
CREATE TABLE `translations` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`locale` text NOT NULL,
	`value` text NOT NULL,
	`published_version` integer,
	`updated_at` integer NOT NULL,
	`updated_by` text NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `translations_entry_locale_idx` ON `translations` (`entry_id`,`locale`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text,
	`is_superuser` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);