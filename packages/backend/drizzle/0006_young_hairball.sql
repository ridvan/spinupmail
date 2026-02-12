DROP INDEX `email_addresses_userId_idx`;--> statement-breakpoint
CREATE INDEX `email_addresses_user_created_idx` ON `email_addresses` (`user_id`,`created_at`);--> statement-breakpoint
DROP INDEX `email_attachments_emailId_idx`;--> statement-breakpoint
DROP INDEX `email_attachments_addressId_idx`;--> statement-breakpoint
DROP INDEX `email_attachments_userId_idx`;--> statement-breakpoint
CREATE INDEX `email_attachments_user_email_created_idx` ON `email_attachments` (`user_id`,`email_id`,`created_at`);--> statement-breakpoint
DROP INDEX `emails_addressId_idx`;--> statement-breakpoint
DROP INDEX `emails_receivedAt_idx`;--> statement-breakpoint
CREATE INDEX `emails_address_received_idx` ON `emails` (`address_id`,`received_at`);