CREATE TABLE `address_integration_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`address_id` text NOT NULL,
	`integration_id` text NOT NULL,
	`event_type` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`address_id`) REFERENCES `email_addresses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`integration_id`) REFERENCES `organization_integrations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `address_integration_subscriptions_address_event_uidx` ON `address_integration_subscriptions` (`address_id`,`integration_id`,`event_type`);--> statement-breakpoint
CREATE INDEX `address_integration_subscriptions_org_address_event_idx` ON `address_integration_subscriptions` (`organization_id`,`address_id`,`event_type`);--> statement-breakpoint
CREATE INDEX `address_integration_subscriptions_integration_event_idx` ON `address_integration_subscriptions` (`integration_id`,`event_type`);--> statement-breakpoint
CREATE TABLE `integration_delivery_attempts` (
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
	FOREIGN KEY (`dispatch_id`) REFERENCES `integration_dispatches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`integration_id`) REFERENCES `organization_integrations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_delivery_attempts_dispatch_attempt_uidx` ON `integration_delivery_attempts` (`dispatch_id`,`attempt_number`);--> statement-breakpoint
CREATE INDEX `integration_delivery_attempts_integration_started_idx` ON `integration_delivery_attempts` (`integration_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `integration_dispatches` (
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
	FOREIGN KEY (`integration_id`) REFERENCES `organization_integrations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subscription_id`) REFERENCES `address_integration_subscriptions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_dispatches_idempotency_key_uidx` ON `integration_dispatches` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `integration_dispatches_integration_status_created_idx` ON `integration_dispatches` (`integration_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `integration_dispatches_org_status_created_idx` ON `integration_dispatches` (`organization_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `integration_dispatches_source_email_idx` ON `integration_dispatches` (`source_email_id`);--> statement-breakpoint
CREATE TABLE `organization_integration_secrets` (
	`integration_id` text NOT NULL,
	`version` integer NOT NULL,
	`encrypted_config_json` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`integration_id`) REFERENCES `organization_integrations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_integration_secrets_pk` ON `organization_integration_secrets` (`integration_id`,`version`);--> statement-breakpoint
CREATE TABLE `organization_integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`public_config_json` text NOT NULL,
	`active_secret_version` integer NOT NULL,
	`last_validated_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `organization_integrations_org_provider_status_idx` ON `organization_integrations` (`organization_id`,`provider`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `organization_integrations_org_provider_name_uidx` ON `organization_integrations` (`organization_id`,`provider`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `organization_integrations_org_provider_config_uidx` ON `organization_integrations` (`organization_id`,`provider`,`public_config_json`);