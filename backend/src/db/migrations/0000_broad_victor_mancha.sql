CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`details` text,
	`ip_hash` text,
	`hash_of_previous` text,
	`timestamp` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `capsules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`encrypted_content` text NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`capsule_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`release_token_hash` text NOT NULL,
	`release_token_expiry` integer,
	`passphrase_hash` text NOT NULL,
	`released` integer DEFAULT false NOT NULL,
	`released_at` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`capsule_id`) REFERENCES `capsules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `email_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`to_email` text NOT NULL,
	`subject` text NOT NULL,
	`body_type` text NOT NULL,
	`body_data` text NOT NULL,
	`sent_at` integer,
	`failure_reason` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `one_time_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`used` integer DEFAULT false NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `release_links` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`capsule_id` text NOT NULL,
	`token` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`viewed_at` integer,
	`view_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`capsule_id`) REFERENCES `capsules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `timers` (
	`id` text PRIMARY KEY NOT NULL,
	`capsule_id` text NOT NULL,
	`interval` text NOT NULL,
	`last_checkin_at` integer,
	`next_release_at` integer NOT NULL,
	`grace_ends_at` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`capsule_id`) REFERENCES `capsules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_user_id_idx` ON `audit_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_log_action_idx` ON `audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `audit_log_timestamp_idx` ON `audit_log` (`timestamp`);--> statement-breakpoint
CREATE INDEX `capsules_user_id_idx` ON `capsules` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_release_token_hash_unique` ON `contacts` (`release_token_hash`);--> statement-breakpoint
CREATE INDEX `contacts_capsule_id_idx` ON `contacts` (`capsule_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_token_hash_idx` ON `contacts` (`release_token_hash`);--> statement-breakpoint
CREATE INDEX `email_queue_sent_idx` ON `email_queue` (`sent_at`);--> statement-breakpoint
CREATE INDEX `email_queue_to_email_idx` ON `email_queue` (`to_email`);--> statement-breakpoint
CREATE INDEX `one_time_tokens_used_idx` ON `one_time_tokens` (`used`);--> statement-breakpoint
CREATE INDEX `one_time_tokens_expires_idx` ON `one_time_tokens` (`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `release_links_token_unique` ON `release_links` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `release_links_token_hash_unique` ON `release_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `release_links_contact_id_idx` ON `release_links` (`contact_id`);--> statement-breakpoint
CREATE INDEX `release_links_capsule_id_idx` ON `release_links` (`capsule_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `release_links_token_idx` ON `release_links` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `timers_capsule_id_unique` ON `timers` (`capsule_id`);--> statement-breakpoint
CREATE INDEX `timers_status_idx` ON `timers` (`status`);--> statement-breakpoint
CREATE INDEX `timers_next_release_idx` ON `timers` (`next_release_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);