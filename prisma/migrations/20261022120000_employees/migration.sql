-- CreateTable
CREATE TABLE `employees` (
    `id` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `jobTitle` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `userId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `employees_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Every existing staff login becomes an employee, so the staff list starts complete
INSERT INTO `employees` (`id`, `fullName`, `jobTitle`, `isActive`, `userId`, `createdAt`)
SELECT CONCAT('emp_', `id`), `name`,
       CASE `role` WHEN 'MANAGER' THEN 'مدير' WHEN 'ACCOUNTANT' THEN 'محاسب' ELSE 'موظف استقبال' END,
       `isActive`, `id`, `createdAt`
FROM `users` WHERE `role` <> 'THERAPIST';
