UPDATE `email_addresses`
SET `email_count` = COALESCE((
  SELECT COUNT(*)
  FROM `emails`
  WHERE `emails`.`address_id` = `email_addresses`.`id`
), 0);
