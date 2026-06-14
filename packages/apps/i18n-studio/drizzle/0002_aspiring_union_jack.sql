CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace_id` text,
	`actor_id` text,
	`actor_type` text DEFAULT 'user' NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`request_id` text,
	`before` text,
	`after` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`namespace_id`) REFERENCES `namespaces`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_events_ns_created_idx` ON `audit_events` (`namespace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_events_actor_created_idx` ON `audit_events` (`actor_type`,`actor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_events_action_created_idx` ON `audit_events` (`action`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_events_resource_idx` ON `audit_events` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE TABLE `namespace_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`token_hash` text NOT NULL,
	`invited_by` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_by` text,
	`accepted_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`namespace_id`) REFERENCES `namespaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`accepted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `invitations_ns_email_status_idx` ON `namespace_invitations` (`namespace_id`,`email`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_token_hash_idx` ON `namespace_invitations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `invitations_expires_idx` ON `namespace_invitations` (`expires_at`);--> statement-breakpoint
CREATE TABLE `quality_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`key` text NOT NULL,
	`locale` text NOT NULL,
	`source_locale` text,
	`issue_type` text NOT NULL,
	`severity` text DEFAULT 'warning' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`source_version` integer,
	`target_version` integer,
	`rule_version` text NOT NULL,
	`details` text,
	`suppressed_by` text,
	`suppressed_reason` text,
	`suppressed_at` integer,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`namespace_id`) REFERENCES `namespaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`suppressed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `quality_issues_ns_status_type_idx` ON `quality_issues` (`namespace_id`,`status`,`issue_type`);--> statement-breakpoint
CREATE INDEX `quality_issues_ns_locale_status_idx` ON `quality_issues` (`namespace_id`,`locale`,`status`);--> statement-breakpoint
CREATE INDEX `quality_issues_entry_locale_type_idx` ON `quality_issues` (`entry_id`,`locale`,`issue_type`);--> statement-breakpoint
CREATE TABLE `release_items` (
	`id` text PRIMARY KEY NOT NULL,
	`release_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`locale` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`translation_version_id` text NOT NULL,
	`translation_version_number` integer NOT NULL,
	FOREIGN KEY (`release_id`) REFERENCES `releases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `release_items_release_entry_locale_idx` ON `release_items` (`release_id`,`entry_id`,`locale`);--> statement-breakpoint
CREATE INDEX `release_items_release_locale_key_idx` ON `release_items` (`release_id`,`locale`,`key`);--> statement-breakpoint
CREATE TABLE `releases` (
	`id` text PRIMARY KEY NOT NULL,
	`namespace_id` text NOT NULL,
	`bundle_version` integer NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`source` text NOT NULL,
	`note` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`published_at` integer NOT NULL,
	FOREIGN KEY (`namespace_id`) REFERENCES `namespaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `releases_ns_bundle_idx` ON `releases` (`namespace_id`,`bundle_version`);--> statement-breakpoint
CREATE INDEX `releases_ns_created_idx` ON `releases` (`namespace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `translation_task_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`item_id` text,
	`event` text NOT NULL,
	`worker_id` text,
	`actor_id` text,
	`message` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `translation_tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `translation_task_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `task_logs_task_created_idx` ON `translation_task_logs` (`task_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `task_logs_item_created_idx` ON `translation_task_logs` (`item_id`,`created_at`);--> statement-breakpoint
DROP INDEX `task_items_task_entry_idx`;--> statement-breakpoint
ALTER TABLE `translation_task_items` ADD `target_locale` text;--> statement-breakpoint
ALTER TABLE `translation_task_items` ADD `attempt_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `translation_task_items` ADD `leased_by` text;--> statement-breakpoint
ALTER TABLE `translation_task_items` ADD `lease_expires_at` integer;--> statement-breakpoint
ALTER TABLE `translation_task_items` ADD `last_error` text;--> statement-breakpoint
ALTER TABLE `translation_task_items` ADD `completed_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `task_items_task_entry_locale_idx` ON `translation_task_items` (`task_id`,`entry_id`,`target_locale`);--> statement-breakpoint
CREATE INDEX `task_items_task_locale_status_idx` ON `translation_task_items` (`task_id`,`target_locale`,`status`);--> statement-breakpoint
CREATE INDEX `task_items_lease_idx` ON `translation_task_items` (`lease_expires_at`);