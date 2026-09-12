CREATE TABLE `agent_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`request_id` text NOT NULL,
	`metadata_json` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_audit_org_created_idx` ON `agent_audit` (`organization_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `agent_credential_capabilities` (
	`organization_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`capability` text NOT NULL,
	PRIMARY KEY(`organization_id`, `credential_id`, `capability`),
	FOREIGN KEY (`organization_id`,`credential_id`) REFERENCES `agent_credentials`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agent_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`principal_id` text NOT NULL,
	`secret_hash` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`organization_id`,`principal_id`) REFERENCES `agent_principals`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_credentials_org_id_uidx` ON `agent_credentials` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `agent_credentials_org_secret_hash_uidx` ON `agent_credentials` (`organization_id`,`secret_hash`);--> statement-breakpoint
CREATE INDEX `agent_credentials_org_principal_idx` ON `agent_credentials` (`organization_id`,`principal_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `agent_enrollment_capabilities` (
	`organization_id` text NOT NULL,
	`enrollment_id` text NOT NULL,
	`capability` text NOT NULL,
	PRIMARY KEY(`organization_id`, `enrollment_id`, `capability`),
	FOREIGN KEY (`organization_id`,`enrollment_id`) REFERENCES `agent_enrollments`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agent_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`name` text NOT NULL,
	`inbox_limit` integer NOT NULL,
	`credential_expires_in_days` integer NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`consumed_by_principal_id` text,
	`revoked_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`consumed_by_principal_id`) REFERENCES `agent_principals`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_enrollments_org_id_uidx` ON `agent_enrollments` (`organization_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `agent_enrollments_org_token_hash_uidx` ON `agent_enrollments` (`organization_id`,`token_hash`);--> statement-breakpoint
CREATE INDEX `agent_enrollments_org_created_idx` ON `agent_enrollments` (`organization_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `agent_idempotency_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`operation` text NOT NULL,
	`key` text NOT NULL,
	`request_hash` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`result_type` text,
	`result_id` text,
	`response_json` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_idempotency_scope_key_uidx` ON `agent_idempotency_keys` (`organization_id`,`actor_id`,`operation`,`key`);--> statement-breakpoint
CREATE INDEX `agent_idempotency_org_created_idx` ON `agent_idempotency_keys` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `agent_inbox_grants` (
	`organization_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`inbox_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`organization_id`, `credential_id`, `inbox_id`),
	FOREIGN KEY (`organization_id`,`credential_id`) REFERENCES `agent_credentials`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`,`inbox_id`) REFERENCES `email_addresses`(`organization_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agent_principals` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_principals_org_id_uidx` ON `agent_principals` (`organization_id`,`id`);--> statement-breakpoint
CREATE INDEX `agent_principals_org_created_idx` ON `agent_principals` (`organization_id`,`created_at`,`id`);