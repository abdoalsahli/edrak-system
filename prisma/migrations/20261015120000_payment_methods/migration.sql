-- Payment methods become user-defined, each linked to the box it posts to.

-- CreateTable
CREATE TABLE `payment_methods` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `cashAccountId` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `payment_methods_name_key`(`name`),
    INDEX `payment_methods_cashAccountId_idx`(`cashAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Default methods: cash → the first cash box; transfer / mobile wallet → the first bank account
INSERT INTO `payment_methods` (`id`, `name`, `cashAccountId`, `sortOrder`)
SELECT 'pm_cash', 'نقداً', `id`, 1 FROM `cash_accounts` WHERE `type` = 'CASH' ORDER BY `isActive` DESC, `createdAt` LIMIT 1;

INSERT INTO `payment_methods` (`id`, `name`, `cashAccountId`, `sortOrder`)
SELECT 'pm_transfer', 'تحويل مصرفي', `id`, 2 FROM `cash_accounts` WHERE `type` = 'BANK' ORDER BY `isActive` DESC, `createdAt` LIMIT 1;

INSERT INTO `payment_methods` (`id`, `name`, `cashAccountId`, `sortOrder`)
SELECT 'pm_mobicash', 'موبي كاش', `id`, 3 FROM `cash_accounts` WHERE `type` = 'BANK' ORDER BY `isActive` DESC, `createdAt` LIMIT 1;

-- Existing documents keep their meaning: cash → نقداً, anything else → تحويل مصرفي
ALTER TABLE `payments` ADD COLUMN `paymentMethodId` VARCHAR(191) NULL;
ALTER TABLE `disbursements` ADD COLUMN `paymentMethodId` VARCHAR(191) NULL;

UPDATE `payments` SET `paymentMethodId` = IF(`method` = 'CASH', 'pm_cash', 'pm_transfer');
UPDATE `disbursements` SET `paymentMethodId` = IF(`method` = 'CASH', 'pm_cash', 'pm_transfer');

-- AlterTable
ALTER TABLE `payments` DROP COLUMN `method`, MODIFY `paymentMethodId` VARCHAR(191) NOT NULL;
ALTER TABLE `disbursements` DROP COLUMN `method`, MODIFY `paymentMethodId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `disbursements_paymentMethodId_idx` ON `disbursements`(`paymentMethodId`);
CREATE INDEX `payments_paymentMethodId_idx` ON `payments`(`paymentMethodId`);

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `payment_methods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `disbursements` ADD CONSTRAINT `disbursements_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `payment_methods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payment_methods` ADD CONSTRAINT `payment_methods_cashAccountId_fkey` FOREIGN KEY (`cashAccountId`) REFERENCES `cash_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
