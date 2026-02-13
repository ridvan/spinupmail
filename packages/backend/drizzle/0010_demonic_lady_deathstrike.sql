PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`inviter_id` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_invitations`("id", "organization_id", "email", "role", "status", "expires_at", "created_at", "inviter_id") SELECT "id", "organization_id", "email", "role", "status", "expires_at", "created_at", "inviter_id" FROM `invitations`;--> statement-breakpoint
DROP TABLE `invitations`;--> statement-breakpoint
ALTER TABLE `__new_invitations` RENAME TO `invitations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `invitations_organizationId_idx` ON `invitations` (`organization_id`);--> statement-breakpoint
CREATE INDEX `invitations_email_idx` ON `invitations` (`email`);--> statement-breakpoint
CREATE TABLE `__new_members` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_members`("id", "organization_id", "user_id", "role", "created_at") SELECT "id", "organization_id", "user_id", "role", "created_at" FROM `members`;--> statement-breakpoint
DROP TABLE `members`;--> statement-breakpoint
ALTER TABLE `__new_members` RENAME TO `members`;--> statement-breakpoint
CREATE INDEX `members_organizationId_idx` ON `members` (`organization_id`);--> statement-breakpoint
CREATE INDEX `members_userId_idx` ON `members` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_email_addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`user_id` text NOT NULL,
	`address` text NOT NULL,
	`local_part` text NOT NULL,
	`domain` text NOT NULL,
	`tag` text,
	`meta` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`expires_at` integer,
	`auto_created` integer DEFAULT false NOT NULL,
	`last_received_at` integer,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_email_addresses`("id", "organization_id", "user_id", "address", "local_part", "domain", "tag", "meta", "created_at", "expires_at", "auto_created", "last_received_at") SELECT "id", "organization_id", "user_id", "address", "local_part", "domain", "tag", "meta", "created_at", "expires_at", "auto_created", "last_received_at" FROM `email_addresses`;--> statement-breakpoint
DROP TABLE `email_addresses`;--> statement-breakpoint
ALTER TABLE `__new_email_addresses` RENAME TO `email_addresses`;--> statement-breakpoint
CREATE UNIQUE INDEX `email_addresses_address_unique` ON `email_addresses` (`address`);--> statement-breakpoint
CREATE INDEX `email_addresses_domain_idx` ON `email_addresses` (`domain`);--> statement-breakpoint
CREATE INDEX `email_addresses_org_created_idx` ON `email_addresses` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `email_addresses_org_user_created_idx` ON `email_addresses` (`organization_id`,`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `__new_email_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`email_id` text NOT NULL,
	`organization_id` text,
	`address_id` text NOT NULL,
	`user_id` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`r2_key` text NOT NULL,
	`disposition` text,
	`content_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`address_id`) REFERENCES `email_addresses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_email_attachments`("id", "email_id", "organization_id", "address_id", "user_id", "filename", "content_type", "size", "r2_key", "disposition", "content_id", "created_at") SELECT "id", "email_id", "organization_id", "address_id", "user_id", "filename", "content_type", "size", "r2_key", "disposition", "content_id", "created_at" FROM `email_attachments`;--> statement-breakpoint
DROP TABLE `email_attachments`;--> statement-breakpoint
ALTER TABLE `__new_email_attachments` RENAME TO `email_attachments`;--> statement-breakpoint
CREATE UNIQUE INDEX `email_attachments_r2_key_unique` ON `email_attachments` (`r2_key`);--> statement-breakpoint
CREATE INDEX `email_attachments_org_email_created_idx` ON `email_attachments` (`organization_id`,`email_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `email_attachments_org_address_created_idx` ON `email_attachments` (`organization_id`,`address_id`,`created_at`);