DROP INDEX `operational_events_created_idx`;--> statement-breakpoint
DROP INDEX `operational_events_severity_created_idx`;--> statement-breakpoint
DROP INDEX `operational_events_type_created_idx`;--> statement-breakpoint
DROP INDEX `operational_events_org_created_idx`;--> statement-breakpoint
CREATE INDEX `operational_events_org_severity_type_created_idx` ON `operational_events` (`organization_id`,`severity`,`type`,"created_at" desc);--> statement-breakpoint
CREATE INDEX `operational_events_created_idx` ON `operational_events` ("created_at" desc);--> statement-breakpoint
CREATE INDEX `operational_events_severity_created_idx` ON `operational_events` (`severity`,"created_at" desc);--> statement-breakpoint
CREATE INDEX `operational_events_type_created_idx` ON `operational_events` (`type`,"created_at" desc);--> statement-breakpoint
CREATE INDEX `operational_events_org_created_idx` ON `operational_events` (`organization_id`,"created_at" desc);