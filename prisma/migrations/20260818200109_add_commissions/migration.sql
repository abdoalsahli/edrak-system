-- AlterTable
ALTER TABLE `therapists` ADD COLUMN `commissionRate` DECIMAL(5, 2) NULL;

-- CreateTable
CREATE TABLE `therapist_commissions` (
    `id` VARCHAR(191) NOT NULL,
    `therapistId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `rate` DECIMAL(5, 2) NOT NULL,
    `baseAmount` DECIMAL(10, 2) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `isPaid` BOOLEAN NOT NULL DEFAULT false,
    `paidAt` DATETIME(3) NULL,
    `paidBy` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `therapist_commissions_sessionId_key`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `therapist_commissions` ADD CONSTRAINT `therapist_commissions_therapistId_fkey` FOREIGN KEY (`therapistId`) REFERENCES `therapists`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `therapist_commissions` ADD CONSTRAINT `therapist_commissions_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `therapist_commissions` ADD CONSTRAINT `therapist_commissions_paidBy_fkey` FOREIGN KEY (`paidBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
