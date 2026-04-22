PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_integration_delivery_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`dispatch_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`integration_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`outcome` text NOT NULL,
	`error` text,
	`error_code` text,
	`error_status` integer,
	`error_retry_after_seconds` integer,
	`started_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_integration_delivery_attempts`("id", "dispatch_id", "organization_id", "integration_id", "attempt_number", "outcome", "error", "error_code", "error_status", "error_retry_after_seconds", "started_at", "completed_at") SELECT "id", "dispatch_id", "organization_id", "integration_id", "attempt_number", "outcome", "error", "error_code", "error_status", "error_retry_after_seconds", "started_at", "completed_at" FROM `integration_delivery_attempts`;--> statement-breakpoint
DROP TABLE `integration_delivery_attempts`;--> statement-breakpoint
ALTER TABLE `__new_integration_delivery_attempts` RENAME TO `integration_delivery_attempts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `integration_delivery_attempts_dispatch_attempt_uidx` ON `integration_delivery_attempts` (`dispatch_id`,`attempt_number`);--> statement-breakpoint
CREATE INDEX `integration_delivery_attempts_org_started_idx` ON `integration_delivery_attempts` (`organization_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `integration_delivery_attempts_integration_started_idx` ON `integration_delivery_attempts` (`integration_id`,`started_at`);