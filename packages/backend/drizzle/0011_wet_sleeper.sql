CREATE TABLE `operational_events` (
	`id` text PRIMARY KEY NOT NULL,
	`severity` text NOT NULL,
	`type` text NOT NULL,
	`organization_id` text,
	`address_id` text,
	`email_id` text,
	`integration_id` text,
	`dispatch_id` text,
	`message` text NOT NULL,
	`metadata_json` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`address_id`) REFERENCES `email_addresses`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`integration_id`) REFERENCES `organization_integrations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`dispatch_id`) REFERENCES `integration_dispatches`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `operational_events_created_idx` ON `operational_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `operational_events_severity_created_idx` ON `operational_events` (`severity`,`created_at`);--> statement-breakpoint
CREATE INDEX `operational_events_type_created_idx` ON `operational_events` (`type`,`created_at`);--> statement-breakpoint
CREATE INDEX `operational_events_org_created_idx` ON `operational_events` (`organization_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `impersonated_by` text;--> statement-breakpoint
ALTER TABLE `users` ADD `role` text;--> statement-breakpoint
ALTER TABLE `users` ADD `banned` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `ban_expires` integer;
