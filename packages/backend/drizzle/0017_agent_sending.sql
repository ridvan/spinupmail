CREATE TABLE `agent_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`inbox_id` text NOT NULL,
	`thread_id` text,
	`created_by_principal_id` text,
	`to_json` text NOT NULL,
	`cc_json` text DEFAULT '[]' NOT NULL,
	`bcc_json` text DEFAULT '[]' NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`body_text` text,
	`body_html` text,
	`in_reply_to` text,
	`references_json` text DEFAULT '[]' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`content_hash` text NOT NULL,
	`approved_hash` text,
	`approved_by_user_id` text,
	`approved_at` integer,
	`submitted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`organization_id`,`inbox_id`) REFERENCES `agent_inboxes`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_drafts_org_id_uidx` ON `agent_drafts` (`organization_id`,`id`);--> statement-breakpoint
CREATE INDEX `agent_drafts_org_inbox_updated_idx` ON `agent_drafts` (`organization_id`,`inbox_id`,`updated_at`,`id`);--> statement-breakpoint
CREATE TABLE `agent_fleet_controls` (
	`id` text PRIMARY KEY NOT NULL,
	`sending_enabled` integer DEFAULT false NOT NULL,
	`updated_by_user_id` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `agent_fleet_controls` (`id`, `sending_enabled`)
VALUES ('outbound', false);--> statement-breakpoint
CREATE TABLE `agent_pilot_entitlements` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'inactive' NOT NULL,
	`monthly_recipient_limit` integer DEFAULT 1000 NOT NULL,
	`storage_byte_limit` integer DEFAULT 1073741824 NOT NULL,
	`assigned_by_user_id` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `agent_provider_events` (
	`organization_id` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`submission_id` text NOT NULL,
	`recipient` text NOT NULL,
	`status` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`organization_id`, `provider_event_id`),
	FOREIGN KEY (`organization_id`,`submission_id`) REFERENCES `agent_submissions`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_provider_events_org_status_occurred_idx` ON `agent_provider_events` (`organization_id`,`status`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `agent_recipient_outcomes` (
	`organization_id` text NOT NULL,
	`submission_id` text NOT NULL,
	`recipient` text NOT NULL,
	`state` text DEFAULT 'queued' NOT NULL,
	`provider_event_id` text,
	`occurred_at` integer,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`organization_id`, `submission_id`, `recipient`),
	FOREIGN KEY (`organization_id`,`submission_id`) REFERENCES `agent_submissions`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agent_recipient_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_recipient_rules_org_kind_value_uidx` ON `agent_recipient_rules` (`organization_id`,`kind`,`value`);--> statement-breakpoint
CREATE INDEX `agent_recipient_rules_org_idx` ON `agent_recipient_rules` (`organization_id`);--> statement-breakpoint
CREATE TABLE `agent_sending_domains` (
	`organization_id` text NOT NULL,
	`domain` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`provider_ready` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`organization_id`, `domain`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agent_sending_policies` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`sending_enabled` integer DEFAULT false NOT NULL,
	`suspended_at` integer,
	`suspension_reason` text,
	`updated_by_user_id` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `agent_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`draft_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`state` text DEFAULT 'queued' NOT NULL,
	`provider_message_id` text,
	`recipient_count` integer NOT NULL,
	`usage_period` text NOT NULL,
	`failure_code` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`,`draft_id`) REFERENCES `agent_drafts`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`credential_id`) REFERENCES `agent_credentials`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_submissions_org_id_uidx` ON `agent_submissions` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `agent_submissions_org_draft_uidx` ON `agent_submissions` (`organization_id`,`draft_id`);--> statement-breakpoint
CREATE INDEX `agent_submissions_state_updated_idx` ON `agent_submissions` (`state`,`updated_at`,`id`);--> statement-breakpoint
CREATE TABLE `agent_suppressions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`recipient` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_suppressions_org_recipient_uidx` ON `agent_suppressions` (`organization_id`,`recipient`);--> statement-breakpoint
CREATE TABLE `agent_usage` (
	`organization_id` text NOT NULL,
	`period` text NOT NULL,
	`reserved_recipients` integer DEFAULT 0 NOT NULL,
	`submitted_recipients` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`organization_id`, `period`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
