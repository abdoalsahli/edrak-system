-- Whether an absent / cancelled session is charged to the patient.
-- Decided explicitly by the user when the outcome is recorded.
-- Completed and pending sessions are always billable regardless of this flag.
ALTER TABLE `sessions` ADD COLUMN `isCharged` BOOLEAN NOT NULL DEFAULT false;
