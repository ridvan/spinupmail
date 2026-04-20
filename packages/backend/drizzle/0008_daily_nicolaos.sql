PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE UNIQUE INDEX `email_addresses_org_id_uidx` ON `email_addresses` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `organization_integrations_org_id_uidx` ON `organization_integrations` (`organization_id`,`id`);--> statement-breakpoint
CREATE TABLE `__new_address_integration_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`address_id` text NOT NULL,
	`integration_id` text NOT NULL,
	`event_type` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`address_id`) REFERENCES `email_addresses`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`integration_id`) REFERENCES `organization_integrations`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_address_integration_subscriptions`("id", "organization_id", "address_id", "integration_id", "event_type", "enabled", "created_at", "updated_at") SELECT "id", "organization_id", "address_id", "integration_id", "event_type", "enabled", "created_at", "updated_at" FROM `address_integration_subscriptions`;--> statement-breakpoint
DROP TABLE `address_integration_subscriptions`;--> statement-breakpoint
ALTER TABLE `__new_address_integration_subscriptions` RENAME TO `address_integration_subscriptions`;--> statement-breakpoint
CREATE UNIQUE INDEX `address_integration_subscriptions_org_id_uidx` ON `address_integration_subscriptions` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `address_integration_subscriptions_address_event_uidx` ON `address_integration_subscriptions` (`address_id`,`integration_id`,`event_type`);--> statement-breakpoint
CREATE INDEX `address_integration_subscriptions_org_address_event_idx` ON `address_integration_subscriptions` (`organization_id`,`address_id`,`event_type`);--> statement-breakpoint
CREATE INDEX `address_integration_subscriptions_integration_event_idx` ON `address_integration_subscriptions` (`integration_id`,`event_type`);--> statement-breakpoint
CREATE TABLE `__new_integration_dispatches` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`integration_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`provider` text NOT NULL,
	`event_type` text NOT NULL,
	`source_email_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`max_attempt_window_ms` integer NOT NULL,
	`next_attempt_at` integer,
	`processing_started_at` integer,
	`delivered_at` integer,
	`last_error` text,
	`last_error_code` text,
	`last_error_status` integer,
	`last_error_retry_after_seconds` integer,
	`queue_message_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`integration_id`) REFERENCES `organization_integrations`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`subscription_id`) REFERENCES `address_integration_subscriptions`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_integration_dispatches`("id", "organization_id", "integration_id", "subscription_id", "provider", "event_type", "source_email_id", "payload_json", "idempotency_key", "status", "attempt_count", "max_attempt_window_ms", "next_attempt_at", "processing_started_at", "delivered_at", "last_error", "last_error_code", "last_error_status", "last_error_retry_after_seconds", "queue_message_id", "created_at", "updated_at") SELECT "id", "organization_id", "integration_id", "subscription_id", "provider", "event_type", "source_email_id", "payload_json", "idempotency_key", "status", "attempt_count", "max_attempt_window_ms", "next_attempt_at", "processing_started_at", "delivered_at", "last_error", "last_error_code", "last_error_status", "last_error_retry_after_seconds", "queue_message_id", "created_at", "updated_at" FROM `integration_dispatches`;--> statement-breakpoint
DROP TABLE `integration_dispatches`;--> statement-breakpoint
ALTER TABLE `__new_integration_dispatches` RENAME TO `integration_dispatches`;--> statement-breakpoint
CREATE UNIQUE INDEX `integration_dispatches_org_id_uidx` ON `integration_dispatches` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `integration_dispatches_idempotency_key_uidx` ON `integration_dispatches` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `integration_dispatches_integration_status_created_idx` ON `integration_dispatches` (`integration_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `integration_dispatches_org_status_created_idx` ON `integration_dispatches` (`organization_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `integration_dispatches_status_next_attempt_idx` ON `integration_dispatches` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `integration_dispatches_source_email_idx` ON `integration_dispatches` (`source_email_id`);--> statement-breakpoint
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
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`dispatch_id`) REFERENCES `integration_dispatches`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`integration_id`) REFERENCES `organization_integrations`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_integration_delivery_attempts`("id", "dispatch_id", "organization_id", "integration_id", "attempt_number", "outcome", "error", "error_code", "error_status", "error_retry_after_seconds", "started_at", "completed_at") SELECT "id", "dispatch_id", "organization_id", "integration_id", "attempt_number", "outcome", "error", "error_code", "error_status", "error_retry_after_seconds", "started_at", "completed_at" FROM `integration_delivery_attempts`;--> statement-breakpoint
DROP TABLE `integration_delivery_attempts`;--> statement-breakpoint
ALTER TABLE `__new_integration_delivery_attempts` RENAME TO `integration_delivery_attempts`;--> statement-breakpoint
CREATE UNIQUE INDEX `integration_delivery_attempts_dispatch_attempt_uidx` ON `integration_delivery_attempts` (`dispatch_id`,`attempt_number`);--> statement-breakpoint
CREATE INDEX `integration_delivery_attempts_integration_started_idx` ON `integration_delivery_attempts` (`integration_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `__new_organization_integration_secrets` (
	`integration_id` text NOT NULL,
	`version` integer NOT NULL,
	`encrypted_config_json` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`integration_id`, `version`),
	FOREIGN KEY (`integration_id`) REFERENCES `organization_integrations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_organization_integration_secrets`("integration_id", "version", "encrypted_config_json", "created_at") SELECT "integration_id", "version", "encrypted_config_json", "created_at" FROM `organization_integration_secrets`;--> statement-breakpoint
DROP TABLE `organization_integration_secrets`;--> statement-breakpoint
ALTER TABLE `__new_organization_integration_secrets` RENAME TO `organization_integration_secrets`;--> statement-breakpoint
CREATE UNIQUE INDEX `organization_integration_secrets_integration_version_uidx` ON `organization_integration_secrets` (`integration_id`,`version`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
