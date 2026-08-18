/*
  Warnings:

  - Added the required column `commissionType` to the `therapist_commissions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `therapist_commissions` ADD COLUMN `commissionType` ENUM('PERCENTAGE', 'FIXED') NOT NULL,
    MODIFY `rate` DECIMAL(5, 2) NULL,
    MODIFY `baseAmount` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `therapists` ADD COLUMN `commissionFixed` DECIMAL(10, 2) NULL,
    ADD COLUMN `commissionType` ENUM('PERCENTAGE', 'FIXED') NULL;
