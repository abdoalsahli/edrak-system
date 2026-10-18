-- Each program negotiates its own total value and its own total therapist commission,
-- so the commission is agreed per program rather than taken from the therapist's default rate.
ALTER TABLE `programs` ADD COLUMN `sessionCommission` DECIMAL(10,2) NULL;
ALTER TABLE `sessions` ADD COLUMN `commissionAmount` DECIMAL(10,2) NULL;

-- A commission is recorded on the therapist account the moment the programme is created,
-- but it is only EARNED once the session is actually delivered. Existing rows were all
-- created on delivery, so they are earned by definition.
ALTER TABLE `therapist_commissions` ADD COLUMN `isEarned` BOOLEAN NOT NULL DEFAULT false;
UPDATE `therapist_commissions` SET `isEarned` = true;
