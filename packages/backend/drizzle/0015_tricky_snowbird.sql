ALTER TABLE `users` ADD `normalized_email` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_normalized_email_unique` ON `users` (`normalized_email`);