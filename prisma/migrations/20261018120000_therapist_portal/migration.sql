-- AlterTable
ALTER TABLE `users` MODIFY `role` ENUM('RECEPTIONIST', 'MANAGER', 'ACCOUNTANT', 'THERAPIST') NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `therapists_userId_key` ON `therapists`(`userId`);

-- AddForeignKey
ALTER TABLE `therapists` ADD CONSTRAINT `therapists_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

