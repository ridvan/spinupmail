DELETE FROM `emails_search`
WHERE `email_id` IN (
	SELECT `id`
	FROM `emails`
	WHERE `message_id` IS NOT NULL
		AND `rowid` NOT IN (
			SELECT min(`rowid`)
			FROM `emails`
			WHERE `message_id` IS NOT NULL
			GROUP BY `address_id`, `message_id`
		)
);
--> statement-breakpoint
DELETE FROM `emails`
WHERE `message_id` IS NOT NULL
	AND `rowid` NOT IN (
		SELECT min(`rowid`)
		FROM `emails`
		WHERE `message_id` IS NOT NULL
		GROUP BY `address_id`, `message_id`
	);
--> statement-breakpoint
UPDATE `email_addresses`
SET `email_count` = (
	SELECT count(*)
	FROM `emails`
	WHERE `emails`.`address_id` = `email_addresses`.`id`
);
--> statement-breakpoint
CREATE UNIQUE INDEX `emails_address_message_id_unique` ON `emails` (`address_id`,`message_id`);
