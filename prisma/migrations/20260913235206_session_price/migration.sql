-- Per-session agreed price, entered by the user at booking time
ALTER TABLE `sessions` ADD COLUMN `price` DECIMAL(10,2) NULL;
ALTER TABLE `programs` ADD COLUMN `sessionPrice` DECIMAL(10,2) NULL;

-- Backfill from the service default so existing rows keep their value
UPDATE `sessions` s
  JOIN `services` sv ON sv.id = s.serviceId
  SET s.price = sv.defaultPrice
  WHERE s.price IS NULL;

UPDATE `programs` p
  JOIN `services` sv ON sv.id = p.serviceId
  SET p.sessionPrice = sv.defaultPrice
  WHERE p.sessionPrice IS NULL;
