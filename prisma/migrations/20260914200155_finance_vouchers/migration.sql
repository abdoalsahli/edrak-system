-- ─── Cash accounts (صناديق وحسابات بنكية) ───────────────────────────────────
CREATE TABLE `cash_accounts` (
  `id`             VARCHAR(191) NOT NULL,
  `name`           VARCHAR(191) NOT NULL,
  `type`           ENUM('CASH','BANK') NOT NULL,
  `accountNumber`  VARCHAR(191) NULL,
  `openingBalance` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `isActive`       BOOLEAN NOT NULL DEFAULT true,
  `notes`          VARCHAR(191) NULL,
  `createdAt`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Disbursements (سندات صرف) ───────────────────────────────────────────────
CREATE TABLE `disbursements` (
  `id`              VARCHAR(191) NOT NULL,
  `voucherNumber`   VARCHAR(32) NOT NULL,
  `type`            ENUM('COMMISSION','REFUND','EXPENSE','SALARY','OTHER') NOT NULL,
  `cashAccountId`   VARCHAR(191) NOT NULL,
  `amount`          DECIMAL(12,2) NOT NULL,
  `paymentDate`     DATE NOT NULL,
  `method`          ENUM('CASH','CARD','BANK_TRANSFER','INSURANCE') NOT NULL,
  `therapistId`     VARCHAR(191) NULL,
  `patientId`       VARCHAR(191) NULL,
  `expenseCategory` ENUM('RENT','SALARIES','UTILITIES','SUPPLIES','MAINTENANCE','MARKETING','GOVERNMENT','OTHER') NULL,
  `description`     VARCHAR(191) NOT NULL,
  `referenceNumber` VARCHAR(191) NULL,
  `issuedBy`        VARCHAR(191) NOT NULL,
  `notes`           TEXT NULL,
  `createdAt`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `disbursements_voucherNumber_key`(`voucherNumber`),
  INDEX `disbursements_cashAccountId_idx`(`cashAccountId`),
  INDEX `disbursements_paymentDate_idx`(`paymentDate`),
  INDEX `disbursements_type_idx`(`type`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Document counters (ترقيم تسلسلي) ────────────────────────────────────────
CREATE TABLE `document_counters` (
  `id`         VARCHAR(191) NOT NULL,
  `docType`    VARCHAR(191) NOT NULL,
  `year`       INTEGER NOT NULL,
  `lastNumber` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `document_counters_docType_year_key`(`docType`, `year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Payments: voucher number + cash account ─────────────────────────────────
ALTER TABLE `payments` ADD COLUMN `voucherNumber` VARCHAR(32) NULL;
ALTER TABLE `payments` ADD COLUMN `cashAccountId` VARCHAR(191) NULL;

-- Backfill sequential receipt numbers for existing payments
UPDATE `payments` p
JOIN (
  SELECT id,
         CONCAT('RCV-', YEAR(paymentDate), '-',
                LPAD(ROW_NUMBER() OVER (PARTITION BY YEAR(paymentDate) ORDER BY createdAt, id), 5, '0')) AS vn
  FROM `payments`
) x ON x.id = p.id
SET p.voucherNumber = x.vn;

ALTER TABLE `payments` MODIFY COLUMN `voucherNumber` VARCHAR(32) NOT NULL;
CREATE UNIQUE INDEX `payments_voucherNumber_key` ON `payments`(`voucherNumber`);

-- Seed the receipt counter from what was just backfilled
INSERT INTO `document_counters` (`id`, `docType`, `year`, `lastNumber`)
SELECT CONCAT('ctr_rcv_', y), 'RECEIPT', y, c FROM (
  SELECT YEAR(paymentDate) AS y, COUNT(*) AS c
  FROM `payments`
  GROUP BY YEAR(paymentDate)
) t;

-- ─── Commissions: link to the voucher that paid them ─────────────────────────
ALTER TABLE `therapist_commissions` ADD COLUMN `disbursementId` VARCHAR(191) NULL;

-- ─── Foreign keys ────────────────────────────────────────────────────────────
ALTER TABLE `disbursements` ADD CONSTRAINT `disbursements_cashAccountId_fkey`
  FOREIGN KEY (`cashAccountId`) REFERENCES `cash_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `disbursements` ADD CONSTRAINT `disbursements_therapistId_fkey`
  FOREIGN KEY (`therapistId`) REFERENCES `therapists`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `disbursements` ADD CONSTRAINT `disbursements_patientId_fkey`
  FOREIGN KEY (`patientId`) REFERENCES `patients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `disbursements` ADD CONSTRAINT `disbursements_issuedBy_fkey`
  FOREIGN KEY (`issuedBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `payments` ADD CONSTRAINT `payments_cashAccountId_fkey`
  FOREIGN KEY (`cashAccountId`) REFERENCES `cash_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `therapist_commissions` ADD CONSTRAINT `therapist_commissions_disbursementId_fkey`
  FOREIGN KEY (`disbursementId`) REFERENCES `disbursements`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
