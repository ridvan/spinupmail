CREATE VIRTUAL TABLE `emails_search` USING fts5(
	`subject`,
	`sender`,
	`sender_address`,
	`body_text`,
	`body_html`,
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
	`body_html`,
	`email_id`
)
SELECT
	`rowid`,
	coalesce(`subject`, ''),
	coalesce(`sender`, ''),
	coalesce(`from`, ''),
	coalesce(`body_text`, ''),
	coalesce(`body_html`, ''),
	`id`
FROM `emails`;
--> statement-breakpoint
CREATE TRIGGER `emails_search_ai` AFTER INSERT ON `emails` BEGIN
	INSERT INTO `emails_search` (
		`rowid`,
		`subject`,
		`sender`,
		`sender_address`,
		`body_text`,
		`body_html`,
		`email_id`
	)
	VALUES (
		new.`rowid`,
		coalesce(new.`subject`, ''),
		coalesce(new.`sender`, ''),
		coalesce(new.`from`, ''),
		coalesce(new.`body_text`, ''),
		coalesce(new.`body_html`, ''),
		new.`id`
	);
END;
--> statement-breakpoint
CREATE TRIGGER `emails_search_ad` AFTER DELETE ON `emails` BEGIN
	INSERT INTO `emails_search` (
		`emails_search`,
		`rowid`,
		`subject`,
		`sender`,
		`sender_address`,
		`body_text`,
		`body_html`,
		`email_id`
	)
	VALUES (
		'delete',
		old.`rowid`,
		coalesce(old.`subject`, ''),
		coalesce(old.`sender`, ''),
		coalesce(old.`from`, ''),
		coalesce(old.`body_text`, ''),
		coalesce(old.`body_html`, ''),
		old.`id`
	);
END;
--> statement-breakpoint
CREATE TRIGGER `emails_search_au` AFTER UPDATE OF `subject`, `sender`, `from`, `body_text`, `body_html` ON `emails` BEGIN
	INSERT INTO `emails_search` (
		`emails_search`,
		`rowid`,
		`subject`,
		`sender`,
		`sender_address`,
		`body_text`,
		`body_html`,
		`email_id`
	)
	VALUES (
		'delete',
		old.`rowid`,
		coalesce(old.`subject`, ''),
		coalesce(old.`sender`, ''),
		coalesce(old.`from`, ''),
		coalesce(old.`body_text`, ''),
		coalesce(old.`body_html`, ''),
		old.`id`
	);
	INSERT INTO `emails_search` (
		`rowid`,
		`subject`,
		`sender`,
		`sender_address`,
		`body_text`,
		`body_html`,
		`email_id`
	)
	VALUES (
		new.`rowid`,
		coalesce(new.`subject`, ''),
		coalesce(new.`sender`, ''),
		coalesce(new.`from`, ''),
		coalesce(new.`body_text`, ''),
		coalesce(new.`body_html`, ''),
		new.`id`
	);
END;
