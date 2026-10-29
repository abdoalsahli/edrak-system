-- CreateTable
CREATE TABLE `treatment_plans` (
    `id` VARCHAR(191) NOT NULL,
    `programId` VARCHAR(191) NOT NULL,
    `cycleNumber` INTEGER NOT NULL,
    `fromSequence` INTEGER NOT NULL,
    `toSequence` INTEGER NOT NULL,
    `therapistId` VARCHAR(191) NOT NULL,
    `planDate` DATE NOT NULL,
    `caseSummary` TEXT NOT NULL,
    `longTermGoals` TEXT NOT NULL,
    `methods` TEXT NOT NULL,
    `focusAreas` JSON NOT NULL,
    `notes` TEXT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED') NOT NULL DEFAULT 'DRAFT',
    `submittedAt` DATETIME(3) NULL,
    `reviewNote` TEXT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `treatment_plans_programId_cycleNumber_key`(`programId`, `cycleNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plan_goals` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `text` TEXT NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `achievement` ENUM('ACHIEVED', 'PARTIAL', 'NOT_ACHIEVED') NULL,

    INDEX `plan_goals_planId_idx`(`planId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `follow_up_reports` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `therapistId` VARCHAR(191) NOT NULL,
    `reportDate` DATE NOT NULL,
    `diagnosis` TEXT NOT NULL,
    `progressLevel` VARCHAR(191) NOT NULL,
    `changes` JSON NOT NULL,
    `parentCommitment` VARCHAR(191) NOT NULL,
    `obstacles` JSON NOT NULL,
    `recommendations` TEXT NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED') NOT NULL DEFAULT 'DRAFT',
    `submittedAt` DATETIME(3) NULL,
    `reviewNote` TEXT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `follow_up_reports_planId_key`(`planId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `treatment_plans` ADD CONSTRAINT `treatment_plans_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `programs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treatment_plans` ADD CONSTRAINT `treatment_plans_therapistId_fkey` FOREIGN KEY (`therapistId`) REFERENCES `therapists`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treatment_plans` ADD CONSTRAINT `treatment_plans_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treatment_plans` ADD CONSTRAINT `treatment_plans_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plan_goals` ADD CONSTRAINT `plan_goals_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `treatment_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follow_up_reports` ADD CONSTRAINT `follow_up_reports_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `treatment_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follow_up_reports` ADD CONSTRAINT `follow_up_reports_therapistId_fkey` FOREIGN KEY (`therapistId`) REFERENCES `therapists`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follow_up_reports` ADD CONSTRAINT `follow_up_reports_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follow_up_reports` ADD CONSTRAINT `follow_up_reports_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

