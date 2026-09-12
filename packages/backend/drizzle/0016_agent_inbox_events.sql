CREATE TABLE `agent_address_tombstones` (
	`address` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`inbox_id` text NOT NULL,
	`deleted_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_address_tombstones_org_address_uidx` ON `agent_address_tombstones` (`organization_id`,`address`);--> statement-breakpoint
CREATE TABLE `agent_event_outbox` (
	`event_id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`available_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`published_at` integer,
	`acknowledged_at` integer,
	`last_error` text,
	FOREIGN KEY (`organization_id`,`event_id`) REFERENCES `agent_events`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_event_outbox_state_available_idx` ON `agent_event_outbox` (`state`,`available_at`,`event_id`);--> statement-breakpoint
CREATE TABLE `agent_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`inbox_id` text,
	`type` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`data_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_events_org_id_uidx` ON `agent_events` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `agent_events_org_type_resource_uidx` ON `agent_events` (`organization_id`,`type`,`resource_type`,`resource_id`);--> statement-breakpoint
CREATE INDEX `agent_events_org_created_idx` ON `agent_events` (`organization_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `agent_inboxes` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`principal_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`organization_id`,`id`) REFERENCES `email_addresses`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`principal_id`) REFERENCES `agent_principals`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_inboxes_org_id_uidx` ON `agent_inboxes` (`organization_id`,`id`);--> statement-breakpoint
CREATE INDEX `agent_inboxes_org_principal_created_idx` ON `agent_inboxes` (`organization_id`,`principal_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `agent_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`inbox_id` text NOT NULL,
	`subject` text,
	`message_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`,`inbox_id`) REFERENCES `agent_inboxes`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_threads_org_id_uidx` ON `agent_threads` (`organization_id`,`id`);--> statement-breakpoint
CREATE INDEX `agent_threads_org_inbox_updated_idx` ON `agent_threads` (`organization_id`,`inbox_id`,`updated_at`,`id`);--> statement-breakpoint
ALTER TABLE `agent_credentials` ADD `inbox_limit` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `emails` ADD `organization_id` text REFERENCES organizations(id);--> statement-breakpoint
UPDATE `emails`
SET `organization_id` = (
	SELECT `organization_id` FROM `email_addresses`
	WHERE `email_addresses`.`id` = `emails`.`address_id`
)
WHERE `organization_id` IS NULL;--> statement-breakpoint
ALTER TABLE `emails` ADD `in_reply_to` text;--> statement-breakpoint
ALTER TABLE `emails` ADD `references_json` text;--> statement-breakpoint
ALTER TABLE `emails` ADD `thread_id` text;--> statement-breakpoint
ALTER TABLE `emails` ADD `direction` text DEFAULT 'inbound' NOT NULL;--> statement-breakpoint
ALTER TABLE `emails` ADD `delivery_state` text DEFAULT 'received' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `emails_org_id_uidx` ON `emails` (`organization_id`,`id`);--> statement-breakpoint
CREATE INDEX `emails_org_thread_received_idx` ON `emails` (`organization_id`,`thread_id`,`received_at`,`id`);
