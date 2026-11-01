BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[users] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [password] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [users_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [users_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [users_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[accounts] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [provider] NVARCHAR(1000) NOT NULL,
    [providerAccountId] NVARCHAR(1000) NOT NULL,
    [refresh_token] NVARCHAR(max),
    [access_token] NVARCHAR(max),
    [expires_at] INT,
    [token_type] NVARCHAR(1000),
    [scope] NVARCHAR(1000),
    [id_token] NVARCHAR(max),
    [session_state] NVARCHAR(1000),
    CONSTRAINT [accounts_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [accounts_provider_providerAccountId_key] UNIQUE NONCLUSTERED ([provider],[providerAccountId])
);

-- CreateTable
CREATE TABLE [dbo].[auth_sessions] (
    [id] NVARCHAR(1000) NOT NULL,
    [sessionToken] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [expires] DATETIME2 NOT NULL,
    CONSTRAINT [auth_sessions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [auth_sessions_sessionToken_key] UNIQUE NONCLUSTERED ([sessionToken])
);

-- CreateTable
CREATE TABLE [dbo].[verification_tokens] (
    [identifier] NVARCHAR(1000) NOT NULL,
    [token] NVARCHAR(1000) NOT NULL,
    [expires] DATETIME2 NOT NULL,
    CONSTRAINT [verification_tokens_token_key] UNIQUE NONCLUSTERED ([token]),
    CONSTRAINT [verification_tokens_identifier_token_key] UNIQUE NONCLUSTERED ([identifier],[token])
);

-- CreateTable
CREATE TABLE [dbo].[therapists] (
    [id] NVARCHAR(1000) NOT NULL,
    [fullName] NVARCHAR(1000) NOT NULL,
    [specialty] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [therapists_isActive_df] DEFAULT 1,
    [commissionType] NVARCHAR(1000),
    [commissionRate] DECIMAL(5,2),
    [commissionFixed] DECIMAL(10,2),
    [userId] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [therapists_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [therapists_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- Unique when set (a filtered index allows many NULLs)
CREATE UNIQUE NONCLUSTERED INDEX [therapists_userId_key] ON [dbo].[therapists]([userId]) WHERE [userId] IS NOT NULL;

-- CreateTable
CREATE TABLE [dbo].[employees] (
    [id] NVARCHAR(1000) NOT NULL,
    [fullName] NVARCHAR(1000) NOT NULL,
    [jobTitle] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [employees_isActive_df] DEFAULT 1,
    [userId] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [employees_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [employees_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- Unique when set (a filtered index allows many NULLs)
CREATE UNIQUE NONCLUSTERED INDEX [employees_userId_key] ON [dbo].[employees]([userId]) WHERE [userId] IS NOT NULL;

-- CreateTable
CREATE TABLE [dbo].[services] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [deliveryType] NVARCHAR(1000) NOT NULL,
    [defaultSessionsPerWeek] INT,
    [defaultTotalSessions] INT,
    [defaultDurationMin] INT NOT NULL CONSTRAINT [services_defaultDurationMin_df] DEFAULT 60,
    [defaultBillingCycleType] NVARCHAR(1000),
    [defaultBillingCycleValue] INT,
    [defaultPrice] DECIMAL(10,2),
    [isActive] BIT NOT NULL CONSTRAINT [services_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [services_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [services_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[system_settings] (
    [id] NVARCHAR(1000) NOT NULL,
    [key] NVARCHAR(1000) NOT NULL,
    [value] NVARCHAR(1000) NOT NULL,
    [updatedBy] NVARCHAR(1000) NOT NULL,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [system_settings_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [system_settings_key_key] UNIQUE NONCLUSTERED ([key])
);

-- CreateTable
CREATE TABLE [dbo].[center_hours] (
    [id] NVARCHAR(1000) NOT NULL,
    [dayOfWeek] INT NOT NULL,
    [openTime] NVARCHAR(1000) NOT NULL,
    [closeTime] NVARCHAR(1000) NOT NULL,
    [isOpen] BIT NOT NULL CONSTRAINT [center_hours_isOpen_df] DEFAULT 1,
    CONSTRAINT [center_hours_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [center_hours_dayOfWeek_key] UNIQUE NONCLUSTERED ([dayOfWeek])
);

-- CreateTable
CREATE TABLE [dbo].[center_holidays] (
    [id] NVARCHAR(1000) NOT NULL,
    [date] DATE NOT NULL,
    [description] NVARCHAR(1000),
    CONSTRAINT [center_holidays_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[rooms] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [rooms_isActive_df] DEFAULT 1,
    CONSTRAINT [rooms_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[therapist_availability] (
    [id] NVARCHAR(1000) NOT NULL,
    [therapistId] NVARCHAR(1000) NOT NULL,
    [dayOfWeek] INT NOT NULL,
    [startTime] NVARCHAR(1000) NOT NULL,
    [endTime] NVARCHAR(1000) NOT NULL,
    CONSTRAINT [therapist_availability_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [therapist_availability_therapistId_dayOfWeek_key] UNIQUE NONCLUSTERED ([therapistId],[dayOfWeek])
);

-- CreateTable
CREATE TABLE [dbo].[therapist_availability_overrides] (
    [id] NVARCHAR(1000) NOT NULL,
    [therapistId] NVARCHAR(1000) NOT NULL,
    [overrideDate] DATE NOT NULL,
    [isAvailable] BIT NOT NULL,
    [startTime] NVARCHAR(1000),
    [endTime] NVARCHAR(1000),
    [reason] NVARCHAR(1000),
    CONSTRAINT [therapist_availability_overrides_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [therapist_availability_overrides_therapistId_overrideDate_key] UNIQUE NONCLUSTERED ([therapistId],[overrideDate])
);

-- CreateTable
CREATE TABLE [dbo].[patients] (
    [id] NVARCHAR(1000) NOT NULL,
    [fullName] NVARCHAR(1000) NOT NULL,
    [dob] DATE,
    [gender] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [address] NVARCHAR(1000),
    [nationalId] NVARCHAR(1000),
    [patientType] NVARCHAR(1000) NOT NULL CONSTRAINT [patients_patientType_df] DEFAULT 'ADULT',
    [isActive] BIT NOT NULL CONSTRAINT [patients_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [patients_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [patients_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- Unique when set (a filtered index allows many NULLs)
CREATE UNIQUE NONCLUSTERED INDEX [patients_nationalId_key] ON [dbo].[patients]([nationalId]) WHERE [nationalId] IS NOT NULL;

-- CreateTable
CREATE TABLE [dbo].[guardians] (
    [id] NVARCHAR(1000) NOT NULL,
    [patientId] NVARCHAR(1000) NOT NULL,
    [fullName] NVARCHAR(1000) NOT NULL,
    [relationship] NVARCHAR(1000),
    [phone] NVARCHAR(1000),
    [nationalId] NVARCHAR(1000),
    CONSTRAINT [guardians_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [guardians_patientId_key] UNIQUE NONCLUSTERED ([patientId])
);

-- CreateTable
CREATE TABLE [dbo].[sessions] (
    [id] NVARCHAR(1000) NOT NULL,
    [patientId] NVARCHAR(1000) NOT NULL,
    [serviceId] NVARCHAR(1000) NOT NULL,
    [programId] NVARCHAR(1000),
    [programSequenceNumber] INT,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [sessions_status_df] DEFAULT 'PENDING',
    [price] DECIMAL(10,2),
    [isCharged] BIT NOT NULL CONSTRAINT [sessions_isCharged_df] DEFAULT 0,
    [commissionAmount] DECIMAL(10,2),
    [outcomeNotes] NVARCHAR(max),
    [deliveredAt] DATETIME2,
    [createdBy] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [sessions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [sessions_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- Unique when set (a filtered index allows many NULLs)
CREATE UNIQUE NONCLUSTERED INDEX [sessions_programId_programSequenceNumber_key] ON [dbo].[sessions]([programId], [programSequenceNumber]) WHERE [programId] IS NOT NULL AND [programSequenceNumber] IS NOT NULL;

-- CreateTable
CREATE TABLE [dbo].[appointments] (
    [id] NVARCHAR(1000) NOT NULL,
    [sessionId] NVARCHAR(1000) NOT NULL,
    [therapistId] NVARCHAR(1000) NOT NULL,
    [roomId] NVARCHAR(1000),
    [date] DATE NOT NULL,
    [startTime] NVARCHAR(1000) NOT NULL,
    [endTime] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [appointments_status_df] DEFAULT 'SCHEDULED',
    [isMakeup] BIT NOT NULL CONSTRAINT [appointments_isMakeup_df] DEFAULT 0,
    [originalAppointmentId] NVARCHAR(1000),
    [isInsuranceCovered] BIT NOT NULL CONSTRAINT [appointments_isInsuranceCovered_df] DEFAULT 0,
    [insuranceProviderId] NVARCHAR(1000),
    [insuranceClaimRef] NVARCHAR(1000),
    [scheduledBy] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [appointments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [deletedAt] DATETIME2,
    CONSTRAINT [appointments_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[programs] (
    [id] NVARCHAR(1000) NOT NULL,
    [patientId] NVARCHAR(1000) NOT NULL,
    [therapistId] NVARCHAR(1000) NOT NULL,
    [serviceId] NVARCHAR(1000) NOT NULL,
    [startDate] DATE NOT NULL,
    [expectedEndDate] DATE NOT NULL,
    [sessionsPerWeek] INT NOT NULL,
    [originalPlannedSessions] INT NOT NULL,
    [plannedSessions] INT NOT NULL,
    [sessionPrice] DECIMAL(10,2),
    [sessionCommission] DECIMAL(10,2),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [programs_status_df] DEFAULT 'ACTIVE',
    [cancellationReason] NVARCHAR(1000),
    [notes] NVARCHAR(max),
    [createdBy] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [programs_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [programs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[treatment_plans] (
    [id] NVARCHAR(1000) NOT NULL,
    [programId] NVARCHAR(1000) NOT NULL,
    [cycleNumber] INT NOT NULL,
    [fromSequence] INT NOT NULL,
    [toSequence] INT NOT NULL,
    [therapistId] NVARCHAR(1000) NOT NULL,
    [planDate] DATE NOT NULL,
    [caseSummary] NVARCHAR(max) NOT NULL,
    [longTermGoals] NVARCHAR(max) NOT NULL,
    [methods] NVARCHAR(max) NOT NULL,
    [focusAreas] NVARCHAR(max) NOT NULL,
    [notes] NVARCHAR(max),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [treatment_plans_status_df] DEFAULT 'DRAFT',
    [submittedAt] DATETIME2,
    [reviewNote] NVARCHAR(max),
    [reviewedById] NVARCHAR(1000),
    [reviewedAt] DATETIME2,
    [createdById] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [treatment_plans_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [treatment_plans_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [treatment_plans_programId_cycleNumber_key] UNIQUE NONCLUSTERED ([programId],[cycleNumber])
);

-- CreateTable
CREATE TABLE [dbo].[plan_goals] (
    [id] NVARCHAR(1000) NOT NULL,
    [planId] NVARCHAR(1000) NOT NULL,
    [text] NVARCHAR(max) NOT NULL,
    [sortOrder] INT NOT NULL,
    [achievement] NVARCHAR(1000),
    CONSTRAINT [plan_goals_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[follow_up_reports] (
    [id] NVARCHAR(1000) NOT NULL,
    [planId] NVARCHAR(1000) NOT NULL,
    [therapistId] NVARCHAR(1000) NOT NULL,
    [reportDate] DATE NOT NULL,
    [diagnosis] NVARCHAR(max) NOT NULL,
    [progressLevel] NVARCHAR(1000) NOT NULL,
    [changes] NVARCHAR(max) NOT NULL,
    [parentCommitment] NVARCHAR(1000) NOT NULL,
    [obstacles] NVARCHAR(max) NOT NULL,
    [recommendations] NVARCHAR(max) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [follow_up_reports_status_df] DEFAULT 'DRAFT',
    [submittedAt] DATETIME2,
    [reviewNote] NVARCHAR(max),
    [reviewedById] NVARCHAR(1000),
    [reviewedAt] DATETIME2,
    [createdById] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [follow_up_reports_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [follow_up_reports_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [follow_up_reports_planId_key] UNIQUE NONCLUSTERED ([planId])
);

-- CreateTable
CREATE TABLE [dbo].[insurance_providers] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [contactInfo] NVARCHAR(1000),
    [notes] NVARCHAR(max),
    CONSTRAINT [insurance_providers_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[billing_cycles] (
    [id] NVARCHAR(1000) NOT NULL,
    [programId] NVARCHAR(1000) NOT NULL,
    [cycleNumber] INT NOT NULL,
    [cycleType] NVARCHAR(1000) NOT NULL,
    [cycleValue] INT NOT NULL,
    [periodStart] DATE NOT NULL,
    [periodEnd] DATE NOT NULL,
    [expectedSessions] INT NOT NULL CONSTRAINT [billing_cycles_expectedSessions_df] DEFAULT 0,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [billing_cycles_status_df] DEFAULT 'OPEN',
    CONSTRAINT [billing_cycles_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [billing_cycles_programId_cycleNumber_key] UNIQUE NONCLUSTERED ([programId],[cycleNumber])
);

-- CreateTable
CREATE TABLE [dbo].[invoices] (
    [id] NVARCHAR(1000) NOT NULL,
    [billingCycleId] NVARCHAR(1000),
    [programId] NVARCHAR(1000),
    [sessionId] NVARCHAR(1000),
    [patientId] NVARCHAR(1000) NOT NULL,
    [issuedBy] NVARCHAR(1000) NOT NULL,
    [issueDate] DATE NOT NULL,
    [dueDate] DATE,
    [totalAmount] DECIMAL(10,2) NOT NULL CONSTRAINT [invoices_totalAmount_df] DEFAULT 0,
    [paidAmount] DECIMAL(10,2) NOT NULL CONSTRAINT [invoices_paidAmount_df] DEFAULT 0,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [invoices_status_df] DEFAULT 'DRAFT',
    [notes] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [invoices_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [invoices_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- Unique when set (a filtered index allows many NULLs)
CREATE UNIQUE NONCLUSTERED INDEX [invoices_programId_key] ON [dbo].[invoices]([programId]) WHERE [programId] IS NOT NULL;
CREATE UNIQUE NONCLUSTERED INDEX [invoices_sessionId_key] ON [dbo].[invoices]([sessionId]) WHERE [sessionId] IS NOT NULL;

-- CreateTable
CREATE TABLE [dbo].[invoice_lines] (
    [id] NVARCHAR(1000) NOT NULL,
    [invoiceId] NVARCHAR(1000) NOT NULL,
    [sessionId] NVARCHAR(1000),
    [description] NVARCHAR(1000) NOT NULL,
    [qty] INT NOT NULL CONSTRAINT [invoice_lines_qty_df] DEFAULT 1,
    [unitPrice] DECIMAL(10,2) NOT NULL,
    [discount] DECIMAL(10,2) NOT NULL CONSTRAINT [invoice_lines_discount_df] DEFAULT 0,
    [total] DECIMAL(10,2) NOT NULL,
    CONSTRAINT [invoice_lines_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[payments] (
    [id] NVARCHAR(1000) NOT NULL,
    [voucherNumber] NVARCHAR(1000) NOT NULL,
    [invoiceId] NVARCHAR(1000),
    [accountId] NVARCHAR(1000),
    [cashAccountId] NVARCHAR(1000),
    [patientId] NVARCHAR(1000),
    [paymentDate] DATE NOT NULL,
    [amount] DECIMAL(10,2) NOT NULL,
    [paymentMethodId] NVARCHAR(1000) NOT NULL,
    [referenceNumber] NVARCHAR(1000),
    [receivedBy] NVARCHAR(1000) NOT NULL,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [payments_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [payments_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [payments_voucherNumber_key] UNIQUE NONCLUSTERED ([voucherNumber])
);

-- CreateTable
CREATE TABLE [dbo].[documents] (
    [id] NVARCHAR(1000) NOT NULL,
    [patientId] NVARCHAR(1000) NOT NULL,
    [programId] NVARCHAR(1000),
    [sessionId] NVARCHAR(1000),
    [title] NVARCHAR(1000) NOT NULL,
    [filePath] NVARCHAR(1000) NOT NULL,
    [fileType] NVARCHAR(1000) NOT NULL,
    [uploadedBy] NVARCHAR(1000) NOT NULL,
    [uploadedAt] DATETIME2 NOT NULL CONSTRAINT [documents_uploadedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [notes] NVARCHAR(1000),
    CONSTRAINT [documents_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[session_audit_log] (
    [id] NVARCHAR(1000) NOT NULL,
    [sessionId] NVARCHAR(1000) NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [previousValue] NVARCHAR(max),
    [newValue] NVARCHAR(max),
    [performedBy] NVARCHAR(1000) NOT NULL,
    [performedAt] DATETIME2 NOT NULL CONSTRAINT [session_audit_log_performedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [session_audit_log_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[therapist_transfer_log] (
    [id] NVARCHAR(1000) NOT NULL,
    [patientId] NVARCHAR(1000) NOT NULL,
    [programId] NVARCHAR(1000) NOT NULL,
    [fromTherapistId] NVARCHAR(1000) NOT NULL,
    [toTherapistId] NVARCHAR(1000) NOT NULL,
    [transferDate] DATE NOT NULL,
    [reason] NVARCHAR(1000),
    [performedBy] NVARCHAR(1000) NOT NULL,
    [performedAt] DATETIME2 NOT NULL CONSTRAINT [therapist_transfer_log_performedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [therapist_transfer_log_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[therapist_commissions] (
    [id] NVARCHAR(1000) NOT NULL,
    [therapistId] NVARCHAR(1000) NOT NULL,
    [sessionId] NVARCHAR(1000) NOT NULL,
    [commissionType] NVARCHAR(1000) NOT NULL,
    [rate] DECIMAL(5,2),
    [baseAmount] DECIMAL(10,2),
    [amount] DECIMAL(10,2) NOT NULL,
    [isEarned] BIT NOT NULL CONSTRAINT [therapist_commissions_isEarned_df] DEFAULT 0,
    [isPaid] BIT NOT NULL CONSTRAINT [therapist_commissions_isPaid_df] DEFAULT 0,
    [paidAt] DATETIME2,
    [paidBy] NVARCHAR(1000),
    [disbursementId] NVARCHAR(1000),
    [notes] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [therapist_commissions_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [therapist_commissions_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [therapist_commissions_sessionId_key] UNIQUE NONCLUSTERED ([sessionId])
);

-- CreateTable
CREATE TABLE [dbo].[cash_accounts] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [accountNumber] NVARCHAR(1000),
    [openingBalance] DECIMAL(12,2) NOT NULL CONSTRAINT [cash_accounts_openingBalance_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [cash_accounts_isActive_df] DEFAULT 1,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [cash_accounts_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [cash_accounts_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[disbursements] (
    [id] NVARCHAR(1000) NOT NULL,
    [voucherNumber] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [accountId] NVARCHAR(1000),
    [cashAccountId] NVARCHAR(1000) NOT NULL,
    [amount] DECIMAL(12,2) NOT NULL,
    [paymentDate] DATE NOT NULL,
    [paymentMethodId] NVARCHAR(1000) NOT NULL,
    [therapistId] NVARCHAR(1000),
    [patientId] NVARCHAR(1000),
    [expenseCategory] NVARCHAR(1000),
    [description] NVARCHAR(1000) NOT NULL,
    [referenceNumber] NVARCHAR(1000),
    [issuedBy] NVARCHAR(1000) NOT NULL,
    [notes] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [disbursements_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [disbursements_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [disbursements_voucherNumber_key] UNIQUE NONCLUSTERED ([voucherNumber])
);

-- CreateTable
CREATE TABLE [dbo].[payment_methods] (
    [id] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [cashAccountId] NVARCHAR(1000) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [payment_methods_isActive_df] DEFAULT 1,
    [sortOrder] INT NOT NULL CONSTRAINT [payment_methods_sortOrder_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [payment_methods_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [payment_methods_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [payment_methods_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[document_counters] (
    [id] NVARCHAR(1000) NOT NULL,
    [docType] NVARCHAR(1000) NOT NULL,
    [year] INT NOT NULL,
    [lastNumber] INT NOT NULL CONSTRAINT [document_counters_lastNumber_df] DEFAULT 0,
    CONSTRAINT [document_counters_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [document_counters_docType_year_key] UNIQUE NONCLUSTERED ([docType],[year])
);

-- CreateTable
CREATE TABLE [dbo].[ledger_accounts] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [name] NVARCHAR(1000) NOT NULL,
    [kind] NVARCHAR(1000) NOT NULL,
    [nature] NVARCHAR(1000) NOT NULL,
    [patientId] NVARCHAR(1000),
    [therapistId] NVARCHAR(1000),
    [cashAccountId] NVARCHAR(1000),
    [expenseCategory] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [ledger_accounts_isActive_df] DEFAULT 1,
    [notes] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ledger_accounts_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ledger_accounts_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ledger_accounts_code_key] UNIQUE NONCLUSTERED ([code])
);

-- Unique when set (a filtered index allows many NULLs)
CREATE UNIQUE NONCLUSTERED INDEX [ledger_accounts_patientId_key] ON [dbo].[ledger_accounts]([patientId]) WHERE [patientId] IS NOT NULL;
CREATE UNIQUE NONCLUSTERED INDEX [ledger_accounts_therapistId_key] ON [dbo].[ledger_accounts]([therapistId]) WHERE [therapistId] IS NOT NULL;
CREATE UNIQUE NONCLUSTERED INDEX [ledger_accounts_cashAccountId_key] ON [dbo].[ledger_accounts]([cashAccountId]) WHERE [cashAccountId] IS NOT NULL;
CREATE UNIQUE NONCLUSTERED INDEX [ledger_accounts_expenseCategory_key] ON [dbo].[ledger_accounts]([expenseCategory]) WHERE [expenseCategory] IS NOT NULL;

-- CreateTable
CREATE TABLE [dbo].[ledger_entries] (
    [id] NVARCHAR(1000) NOT NULL,
    [accountId] NVARCHAR(1000) NOT NULL,
    [date] DATE NOT NULL,
    [debit] DECIMAL(12,2) NOT NULL CONSTRAINT [ledger_entries_debit_df] DEFAULT 0,
    [credit] DECIMAL(12,2) NOT NULL CONSTRAINT [ledger_entries_credit_df] DEFAULT 0,
    [description] NVARCHAR(1000) NOT NULL,
    [sourceType] NVARCHAR(1000) NOT NULL,
    [sourceId] NVARCHAR(1000) NOT NULL,
    [reference] NVARCHAR(1000),
    [createdBy] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ledger_entries_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ledger_entries_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[settlements] (
    [id] NVARCHAR(1000) NOT NULL,
    [voucherNumber] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [date] DATE NOT NULL,
    [amount] DECIMAL(12,2) NOT NULL,
    [debitAccountId] NVARCHAR(1000),
    [creditAccountId] NVARCHAR(1000),
    [description] NVARCHAR(1000) NOT NULL,
    [notes] NVARCHAR(max),
    [issuedBy] NVARCHAR(1000) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [settlements_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [settlements_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [settlements_voucherNumber_key] UNIQUE NONCLUSTERED ([voucherNumber])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [sessions_patientId_idx] ON [dbo].[sessions]([patientId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [sessions_programId_idx] ON [dbo].[sessions]([programId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [appointments_date_status_idx] ON [dbo].[appointments]([date], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [appointments_therapistId_date_idx] ON [dbo].[appointments]([therapistId], [date]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [programs_patientId_idx] ON [dbo].[programs]([patientId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [plan_goals_planId_idx] ON [dbo].[plan_goals]([planId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [billing_cycles_programId_idx] ON [dbo].[billing_cycles]([programId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [invoices_patientId_status_idx] ON [dbo].[invoices]([patientId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [invoices_status_idx] ON [dbo].[invoices]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [payments_invoiceId_idx] ON [dbo].[payments]([invoiceId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [payments_accountId_idx] ON [dbo].[payments]([accountId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [payments_paymentMethodId_idx] ON [dbo].[payments]([paymentMethodId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [session_audit_log_sessionId_idx] ON [dbo].[session_audit_log]([sessionId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [disbursements_cashAccountId_idx] ON [dbo].[disbursements]([cashAccountId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [disbursements_paymentMethodId_idx] ON [dbo].[disbursements]([paymentMethodId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [disbursements_accountId_idx] ON [dbo].[disbursements]([accountId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [disbursements_paymentDate_idx] ON [dbo].[disbursements]([paymentDate]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [disbursements_type_idx] ON [dbo].[disbursements]([type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [payment_methods_cashAccountId_idx] ON [dbo].[payment_methods]([cashAccountId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ledger_accounts_kind_idx] ON [dbo].[ledger_accounts]([kind]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ledger_entries_accountId_date_idx] ON [dbo].[ledger_entries]([accountId], [date]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ledger_entries_sourceType_sourceId_idx] ON [dbo].[ledger_entries]([sourceType], [sourceId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [settlements_date_idx] ON [dbo].[settlements]([date]);

-- AddForeignKey
ALTER TABLE [dbo].[accounts] ADD CONSTRAINT [accounts_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[auth_sessions] ADD CONSTRAINT [auth_sessions_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[therapists] ADD CONSTRAINT [therapists_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[employees] ADD CONSTRAINT [employees_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[system_settings] ADD CONSTRAINT [system_settings_updatedBy_fkey] FOREIGN KEY ([updatedBy]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[therapist_availability] ADD CONSTRAINT [therapist_availability_therapistId_fkey] FOREIGN KEY ([therapistId]) REFERENCES [dbo].[therapists]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[therapist_availability_overrides] ADD CONSTRAINT [therapist_availability_overrides_therapistId_fkey] FOREIGN KEY ([therapistId]) REFERENCES [dbo].[therapists]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[guardians] ADD CONSTRAINT [guardians_patientId_fkey] FOREIGN KEY ([patientId]) REFERENCES [dbo].[patients]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sessions] ADD CONSTRAINT [sessions_patientId_fkey] FOREIGN KEY ([patientId]) REFERENCES [dbo].[patients]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sessions] ADD CONSTRAINT [sessions_serviceId_fkey] FOREIGN KEY ([serviceId]) REFERENCES [dbo].[services]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sessions] ADD CONSTRAINT [sessions_programId_fkey] FOREIGN KEY ([programId]) REFERENCES [dbo].[programs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[sessions] ADD CONSTRAINT [sessions_createdBy_fkey] FOREIGN KEY ([createdBy]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[appointments] ADD CONSTRAINT [appointments_sessionId_fkey] FOREIGN KEY ([sessionId]) REFERENCES [dbo].[sessions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[appointments] ADD CONSTRAINT [appointments_therapistId_fkey] FOREIGN KEY ([therapistId]) REFERENCES [dbo].[therapists]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[appointments] ADD CONSTRAINT [appointments_roomId_fkey] FOREIGN KEY ([roomId]) REFERENCES [dbo].[rooms]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[appointments] ADD CONSTRAINT [appointments_scheduledBy_fkey] FOREIGN KEY ([scheduledBy]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[appointments] ADD CONSTRAINT [appointments_insuranceProviderId_fkey] FOREIGN KEY ([insuranceProviderId]) REFERENCES [dbo].[insurance_providers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[appointments] ADD CONSTRAINT [appointments_originalAppointmentId_fkey] FOREIGN KEY ([originalAppointmentId]) REFERENCES [dbo].[appointments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[programs] ADD CONSTRAINT [programs_patientId_fkey] FOREIGN KEY ([patientId]) REFERENCES [dbo].[patients]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[programs] ADD CONSTRAINT [programs_therapistId_fkey] FOREIGN KEY ([therapistId]) REFERENCES [dbo].[therapists]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[programs] ADD CONSTRAINT [programs_serviceId_fkey] FOREIGN KEY ([serviceId]) REFERENCES [dbo].[services]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[programs] ADD CONSTRAINT [programs_createdBy_fkey] FOREIGN KEY ([createdBy]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[treatment_plans] ADD CONSTRAINT [treatment_plans_programId_fkey] FOREIGN KEY ([programId]) REFERENCES [dbo].[programs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[treatment_plans] ADD CONSTRAINT [treatment_plans_therapistId_fkey] FOREIGN KEY ([therapistId]) REFERENCES [dbo].[therapists]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[treatment_plans] ADD CONSTRAINT [treatment_plans_reviewedById_fkey] FOREIGN KEY ([reviewedById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[treatment_plans] ADD CONSTRAINT [treatment_plans_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[plan_goals] ADD CONSTRAINT [plan_goals_planId_fkey] FOREIGN KEY ([planId]) REFERENCES [dbo].[treatment_plans]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[follow_up_reports] ADD CONSTRAINT [follow_up_reports_planId_fkey] FOREIGN KEY ([planId]) REFERENCES [dbo].[treatment_plans]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[follow_up_reports] ADD CONSTRAINT [follow_up_reports_therapistId_fkey] FOREIGN KEY ([therapistId]) REFERENCES [dbo].[therapists]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[follow_up_reports] ADD CONSTRAINT [follow_up_reports_reviewedById_fkey] FOREIGN KEY ([reviewedById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[follow_up_reports] ADD CONSTRAINT [follow_up_reports_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[billing_cycles] ADD CONSTRAINT [billing_cycles_programId_fkey] FOREIGN KEY ([programId]) REFERENCES [dbo].[programs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_billingCycleId_fkey] FOREIGN KEY ([billingCycleId]) REFERENCES [dbo].[billing_cycles]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_programId_fkey] FOREIGN KEY ([programId]) REFERENCES [dbo].[programs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_sessionId_fkey] FOREIGN KEY ([sessionId]) REFERENCES [dbo].[sessions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_patientId_fkey] FOREIGN KEY ([patientId]) REFERENCES [dbo].[patients]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_issuedBy_fkey] FOREIGN KEY ([issuedBy]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[invoice_lines] ADD CONSTRAINT [invoice_lines_invoiceId_fkey] FOREIGN KEY ([invoiceId]) REFERENCES [dbo].[invoices]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[invoice_lines] ADD CONSTRAINT [invoice_lines_sessionId_fkey] FOREIGN KEY ([sessionId]) REFERENCES [dbo].[sessions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payments] ADD CONSTRAINT [payments_invoiceId_fkey] FOREIGN KEY ([invoiceId]) REFERENCES [dbo].[invoices]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payments] ADD CONSTRAINT [payments_accountId_fkey] FOREIGN KEY ([accountId]) REFERENCES [dbo].[ledger_accounts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payments] ADD CONSTRAINT [payments_cashAccountId_fkey] FOREIGN KEY ([cashAccountId]) REFERENCES [dbo].[cash_accounts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payments] ADD CONSTRAINT [payments_paymentMethodId_fkey] FOREIGN KEY ([paymentMethodId]) REFERENCES [dbo].[payment_methods]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payments] ADD CONSTRAINT [payments_patientId_fkey] FOREIGN KEY ([patientId]) REFERENCES [dbo].[patients]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payments] ADD CONSTRAINT [payments_receivedBy_fkey] FOREIGN KEY ([receivedBy]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[documents] ADD CONSTRAINT [documents_patientId_fkey] FOREIGN KEY ([patientId]) REFERENCES [dbo].[patients]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[documents] ADD CONSTRAINT [documents_sessionId_fkey] FOREIGN KEY ([sessionId]) REFERENCES [dbo].[sessions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[documents] ADD CONSTRAINT [documents_uploadedBy_fkey] FOREIGN KEY ([uploadedBy]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[session_audit_log] ADD CONSTRAINT [session_audit_log_sessionId_fkey] FOREIGN KEY ([sessionId]) REFERENCES [dbo].[sessions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[session_audit_log] ADD CONSTRAINT [session_audit_log_performedBy_fkey] FOREIGN KEY ([performedBy]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[therapist_transfer_log] ADD CONSTRAINT [therapist_transfer_log_programId_fkey] FOREIGN KEY ([programId]) REFERENCES [dbo].[programs]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[therapist_transfer_log] ADD CONSTRAINT [therapist_transfer_log_fromTherapistId_fkey] FOREIGN KEY ([fromTherapistId]) REFERENCES [dbo].[therapists]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[therapist_transfer_log] ADD CONSTRAINT [therapist_transfer_log_toTherapistId_fkey] FOREIGN KEY ([toTherapistId]) REFERENCES [dbo].[therapists]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[therapist_transfer_log] ADD CONSTRAINT [therapist_transfer_log_performedBy_fkey] FOREIGN KEY ([performedBy]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[therapist_commissions] ADD CONSTRAINT [therapist_commissions_therapistId_fkey] FOREIGN KEY ([therapistId]) REFERENCES [dbo].[therapists]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[therapist_commissions] ADD CONSTRAINT [therapist_commissions_sessionId_fkey] FOREIGN KEY ([sessionId]) REFERENCES [dbo].[sessions]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[therapist_commissions] ADD CONSTRAINT [therapist_commissions_paidBy_fkey] FOREIGN KEY ([paidBy]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[therapist_commissions] ADD CONSTRAINT [therapist_commissions_disbursementId_fkey] FOREIGN KEY ([disbursementId]) REFERENCES [dbo].[disbursements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[disbursements] ADD CONSTRAINT [disbursements_cashAccountId_fkey] FOREIGN KEY ([cashAccountId]) REFERENCES [dbo].[cash_accounts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[disbursements] ADD CONSTRAINT [disbursements_paymentMethodId_fkey] FOREIGN KEY ([paymentMethodId]) REFERENCES [dbo].[payment_methods]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[disbursements] ADD CONSTRAINT [disbursements_accountId_fkey] FOREIGN KEY ([accountId]) REFERENCES [dbo].[ledger_accounts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[disbursements] ADD CONSTRAINT [disbursements_therapistId_fkey] FOREIGN KEY ([therapistId]) REFERENCES [dbo].[therapists]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[disbursements] ADD CONSTRAINT [disbursements_patientId_fkey] FOREIGN KEY ([patientId]) REFERENCES [dbo].[patients]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[disbursements] ADD CONSTRAINT [disbursements_issuedBy_fkey] FOREIGN KEY ([issuedBy]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[payment_methods] ADD CONSTRAINT [payment_methods_cashAccountId_fkey] FOREIGN KEY ([cashAccountId]) REFERENCES [dbo].[cash_accounts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ledger_accounts] ADD CONSTRAINT [ledger_accounts_patientId_fkey] FOREIGN KEY ([patientId]) REFERENCES [dbo].[patients]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ledger_accounts] ADD CONSTRAINT [ledger_accounts_therapistId_fkey] FOREIGN KEY ([therapistId]) REFERENCES [dbo].[therapists]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ledger_accounts] ADD CONSTRAINT [ledger_accounts_cashAccountId_fkey] FOREIGN KEY ([cashAccountId]) REFERENCES [dbo].[cash_accounts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ledger_entries] ADD CONSTRAINT [ledger_entries_accountId_fkey] FOREIGN KEY ([accountId]) REFERENCES [dbo].[ledger_accounts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[settlements] ADD CONSTRAINT [settlements_debitAccountId_fkey] FOREIGN KEY ([debitAccountId]) REFERENCES [dbo].[ledger_accounts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[settlements] ADD CONSTRAINT [settlements_creditAccountId_fkey] FOREIGN KEY ([creditAccountId]) REFERENCES [dbo].[ledger_accounts]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[settlements] ADD CONSTRAINT [settlements_issuedBy_fkey] FOREIGN KEY ([issuedBy]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

