ALTER TABLE `invoices` ADD COLUMN `programId` VARCHAR(191) NULL,
  ADD COLUMN `sessionId` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `invoices_programId_key`(`programId`),
  ADD UNIQUE INDEX `invoices_sessionId_key`(`sessionId`),
  ADD CONSTRAINT `invoices_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `programs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `invoices_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
