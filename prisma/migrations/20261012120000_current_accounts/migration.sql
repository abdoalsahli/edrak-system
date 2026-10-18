-- DropForeignKey
ALTER TABLE `disbursements` DROP FOREIGN KEY `disbursements_patientId_fkey`;

-- DropForeignKey
ALTER TABLE `disbursements` DROP FOREIGN KEY `disbursements_therapistId_fkey`;

-- DropForeignKey
ALTER TABLE `invoices` DROP FOREIGN KEY `fk_invoice_program`;

-- DropForeignKey
ALTER TABLE `invoices` DROP FOREIGN KEY `fk_invoice_session`;

-- DropForeignKey
ALTER TABLE `payments` DROP FOREIGN KEY `payments_patientId_fkey`;

-- AlterTable
ALTER TABLE `disbursements` ADD COLUMN `accountId` VARCHAR(191) NULL,
    MODIFY `voucherNumber` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `payments` ADD COLUMN `accountId` VARCHAR(191) NULL,
    MODIFY `invoiceId` VARCHAR(191) NULL,
    MODIFY `patientId` VARCHAR(191) NULL,
    MODIFY `voucherNumber` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `ledger_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `kind` ENUM('PATIENT', 'THERAPIST', 'EXPENSE', 'CUSTOM') NOT NULL,
    `nature` ENUM('DEBIT', 'CREDIT') NOT NULL,
    `patientId` VARCHAR(191) NULL,
    `therapistId` VARCHAR(191) NULL,
    `expenseCategory` ENUM('RENT', 'SALARIES', 'UTILITIES', 'SUPPLIES', 'MAINTENANCE', 'MARKETING', 'GOVERNMENT', 'OTHER') NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ledger_accounts_code_key`(`code`),
    UNIQUE INDEX `ledger_accounts_patientId_key`(`patientId`),
    UNIQUE INDEX `ledger_accounts_therapistId_key`(`therapistId`),
    UNIQUE INDEX `ledger_accounts_expenseCategory_key`(`expenseCategory`),
    INDEX `ledger_accounts_kind_idx`(`kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ledger_entries` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `debit` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `credit` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `description` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('OPENING', 'INVOICE', 'RECEIPT', 'PAYMENT', 'COMMISSION', 'SETTLEMENT') NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ledger_entries_accountId_date_idx`(`accountId`, `date`),
    INDEX `ledger_entries_sourceType_sourceId_idx`(`sourceType`, `sourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settlements` (
    `id` VARCHAR(191) NOT NULL,
    `voucherNumber` VARCHAR(191) NOT NULL,
    `type` ENUM('DISCOUNT', 'WRITE_OFF', 'CORRECTION', 'TRANSFER', 'OTHER') NOT NULL,
    `date` DATE NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `debitAccountId` VARCHAR(191) NULL,
    `creditAccountId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `issuedBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `settlements_voucherNumber_key`(`voucherNumber`),
    INDEX `settlements_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `disbursements_accountId_idx` ON `disbursements`(`accountId`);

-- CreateIndex
CREATE INDEX `payments_accountId_idx` ON `payments`(`accountId`);

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `programs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `ledger_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `patients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `disbursements` ADD CONSTRAINT `disbursements_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `ledger_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `disbursements` ADD CONSTRAINT `disbursements_therapistId_fkey` FOREIGN KEY (`therapistId`) REFERENCES `therapists`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `disbursements` ADD CONSTRAINT `disbursements_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `patients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_accounts` ADD CONSTRAINT `ledger_accounts_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `patients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_accounts` ADD CONSTRAINT `ledger_accounts_therapistId_fkey` FOREIGN KEY (`therapistId`) REFERENCES `therapists`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `ledger_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_debitAccountId_fkey` FOREIGN KEY (`debitAccountId`) REFERENCES `ledger_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_creditAccountId_fkey` FOREIGN KEY (`creditAccountId`) REFERENCES `ledger_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_issuedBy_fkey` FOREIGN KEY (`issuedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `invoices` RENAME INDEX `programId` TO `invoices_programId_key`;

-- RenameIndex
ALTER TABLE `invoices` RENAME INDEX `sessionId` TO `invoices_sessionId_key`;

