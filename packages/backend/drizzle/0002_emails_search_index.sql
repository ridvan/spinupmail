CREATE VIRTUAL TABLE `emails_search` USING fts5(
	`subject`,
	`sender`,
	`sender_address`,
	`body_text`,
	`email_id` UNINDEXED,
	tokenize = 'unicode61'
);
--> statement-breakpoint
INSERT INTO `emails_search` (
	`rowid`,
	`subject`,
	`sender`,
	`sender_address`,
	`body_text`,
	`email_id`
)
SELECT
	`rowid`,
	coalesce(`subject`, ''),
	coalesce(`sender`, ''),
	coalesce(`from`, ''),
	coalesce(`body_text`, ''),
	`id`
FROM `emails`;
