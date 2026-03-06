PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_apikeys` (
	`id` text PRIMARY KEY NOT NULL,
	`config_id` text DEFAULT 'default' NOT NULL,
	`name` text,
	`start` text,
	`prefix` text,
	`key` text NOT NULL,
	`reference_id` text NOT NULL,
	`refill_interval` integer,
	`refill_amount` integer,
	`last_refill_at` integer,
	`enabled` integer DEFAULT true,
	`rate_limit_enabled` integer DEFAULT true,
	`rate_limit_time_window` integer DEFAULT 86400000,
	`rate_limit_max` integer DEFAULT 10,
	`request_count` integer DEFAULT 0,
	`remaining` integer,
	`last_request` integer,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`permissions` text,
	`metadata` text
);
--> statement-breakpoint
INSERT INTO `__new_apikeys`("id", "config_id", "name", "start", "prefix", "key", "reference_id", "refill_interval", "refill_amount", "last_refill_at", "enabled", "rate_limit_enabled", "rate_limit_time_window", "rate_limit_max", "request_count", "remaining", "last_request", "expires_at", "created_at", "updated_at", "permissions", "metadata") SELECT "id", 'default', "name", "start", "prefix", "key", "user_id", "refill_interval", "refill_amount", "last_refill_at", "enabled", "rate_limit_enabled", "rate_limit_time_window", "rate_limit_max", "request_count", "remaining", "last_request", "expires_at", "created_at", "updated_at", "permissions", "metadata" FROM `apikeys`;--> statement-breakpoint
DROP TABLE `apikeys`;--> statement-breakpoint
ALTER TABLE `__new_apikeys` RENAME TO `apikeys`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `apikeys_key_idx` ON `apikeys` (`key`);--> statement-breakpoint
CREATE INDEX `apikeys_configId_idx` ON `apikeys` (`config_id`);--> statement-breakpoint
CREATE INDEX `apikeys_referenceId_idx` ON `apikeys` (`reference_id`);