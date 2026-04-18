CREATE TABLE `extension_auth_handoffs` (
	`code` text PRIMARY KEY NOT NULL,
	`envelope` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `extension_auth_handoffs_expires_idx` ON `extension_auth_handoffs` (`expires_at`);