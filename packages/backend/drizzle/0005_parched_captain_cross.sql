CREATE TABLE `email_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`email_id` text NOT NULL,
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
	FOREIGN KEY (`address_id`) REFERENCES `email_addresses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_attachments_r2_key_unique` ON `email_attachments` (`r2_key`);--> statement-breakpoint
CREATE INDEX `email_attachments_emailId_idx` ON `email_attachments` (`email_id`);--> statement-breakpoint
CREATE INDEX `email_attachments_addressId_idx` ON `email_attachments` (`address_id`);--> statement-breakpoint
CREATE INDEX `email_attachments_userId_idx` ON `email_attachments` (`user_id`);