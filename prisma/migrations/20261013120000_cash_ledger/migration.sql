-- AlterTable
ALTER TABLE `ledger_accounts` ADD COLUMN `cashAccountId` VARCHAR(191) NULL,
    MODIFY `kind` ENUM('PATIENT', 'THERAPIST', 'EXPENSE', 'CUSTOM', 'CASH') NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `ledger_accounts_cashAccountId_key` ON `ledger_accounts`(`cashAccountId`);

-- AddForeignKey
ALTER TABLE `ledger_accounts` ADD CONSTRAINT `ledger_accounts_cashAccountId_fkey` FOREIGN KEY (`cashAccountId`) REFERENCES `cash_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

