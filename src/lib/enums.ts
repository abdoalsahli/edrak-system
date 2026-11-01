/**
 * The fixed value lists of the database. SQL Server has no enum type in Prisma,
 * so these columns are text and the lists live here, with the same names the
 * code used before (`UserRole.MANAGER`, `type UserRole`).
 */

export const UserRole = {
  RECEPTIONIST: "RECEPTIONIST",
  MANAGER: "MANAGER",
  ACCOUNTANT: "ACCOUNTANT",
  THERAPIST: "THERAPIST", // signs in to see their own schedule and record session outcomes
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const PatientType = {
  ADULT: "ADULT",
  CHILD: "CHILD",
} as const;
export type PatientType = (typeof PatientType)[keyof typeof PatientType];

export const ServiceDeliveryType = {
  SINGLE_SESSION: "SINGLE_SESSION",
  PROGRAM: "PROGRAM",
} as const;
export type ServiceDeliveryType = (typeof ServiceDeliveryType)[keyof typeof ServiceDeliveryType];

export const BillingCycleType = {
  MONTHLY: "MONTHLY",
  PER_N_SESSIONS: "PER_N_SESSIONS",
} as const;
export type BillingCycleType = (typeof BillingCycleType)[keyof typeof BillingCycleType];

export const CommissionType = {
  PERCENTAGE: "PERCENTAGE",
  FIXED: "FIXED",
} as const;
export type CommissionType = (typeof CommissionType)[keyof typeof CommissionType];

export const SessionStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  ABSENT: "ABSENT",
  CANCELLED_BY_PATIENT: "CANCELLED_BY_PATIENT",
  CANCELLED_BY_CENTER: "CANCELLED_BY_CENTER",
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export const AppointmentStatus = {
  SCHEDULED: "SCHEDULED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const ProgramStatus = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  EXTENDED: "EXTENDED",
  CANCELLED: "CANCELLED",
} as const;
export type ProgramStatus = (typeof ProgramStatus)[keyof typeof ProgramStatus];

/** Workflow of a treatment plan or a follow-up report */
export const CaseDocStatus = {
  DRAFT: "DRAFT", // the therapist is still writing it
  SUBMITTED: "SUBMITTED", // sent to management for review
  APPROVED: "APPROVED", // reviewed and accepted
  RETURNED: "RETURNED", // sent back to the therapist with a note
} as const;
export type CaseDocStatus = (typeof CaseDocStatus)[keyof typeof CaseDocStatus];

/** How far a plan goal got by the end of its cycle */
export const GoalAchievement = {
  ACHIEVED: "ACHIEVED",
  PARTIAL: "PARTIAL",
  NOT_ACHIEVED: "NOT_ACHIEVED",
} as const;
export type GoalAchievement = (typeof GoalAchievement)[keyof typeof GoalAchievement];

export const BillingCycleStatus = {
  OPEN: "OPEN",
  INVOICED: "INVOICED",
  CLOSED: "CLOSED",
} as const;
export type BillingCycleStatus = (typeof BillingCycleStatus)[keyof typeof BillingCycleStatus];

export const InvoiceStatus = {
  DRAFT: "DRAFT",
  ISSUED: "ISSUED",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
  VOID: "VOID",
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const CashAccountType = {
  CASH: "CASH", // صندوق نقدي
  BANK: "BANK", // حساب بنكي
} as const;
export type CashAccountType = (typeof CashAccountType)[keyof typeof CashAccountType];

export const DisbursementType = {
  COMMISSION: "COMMISSION", // عمولة أخصائي
  REFUND: "REFUND", // استرداد لمريض
  EXPENSE: "EXPENSE", // مصروف تشغيلي
  SALARY: "SALARY", // راتب
  OTHER: "OTHER",
} as const;
export type DisbursementType = (typeof DisbursementType)[keyof typeof DisbursementType];

export const ExpenseCategory = {
  RENT: "RENT",
  SALARIES: "SALARIES",
  UTILITIES: "UTILITIES",
  SUPPLIES: "SUPPLIES",
  MAINTENANCE: "MAINTENANCE",
  MARKETING: "MARKETING",
  GOVERNMENT: "GOVERNMENT",
  OTHER: "OTHER",
} as const;
export type ExpenseCategory = (typeof ExpenseCategory)[keyof typeof ExpenseCategory];

export const AccountKind = {
  PATIENT: "PATIENT",
  THERAPIST: "THERAPIST",
  EXPENSE: "EXPENSE",
  CUSTOM: "CUSTOM",
  CASH: "CASH", // a cash box or bank account — nature DEBIT (an asset)
} as const;
export type AccountKind = (typeof AccountKind)[keyof typeof AccountKind];

/** How the balance is read. DEBIT: balance = debit − credit (patients, expenses). CREDIT: balance = credit − debit (therapists and other payables). */
export const AccountNature = {
  DEBIT: "DEBIT",
  CREDIT: "CREDIT",
} as const;
export type AccountNature = (typeof AccountNature)[keyof typeof AccountNature];

export const LedgerSource = {
  OPENING: "OPENING",
  INVOICE: "INVOICE",
  RECEIPT: "RECEIPT",
  PAYMENT: "PAYMENT",
  COMMISSION: "COMMISSION",
  SETTLEMENT: "SETTLEMENT",
} as const;
export type LedgerSource = (typeof LedgerSource)[keyof typeof LedgerSource];

export const SettlementType = {
  DISCOUNT: "DISCOUNT", // خصم
  WRITE_OFF: "WRITE_OFF", // إعدام دين
  CORRECTION: "CORRECTION", // تصحيح
  TRANSFER: "TRANSFER", // تحويل بين حسابين
  OTHER: "OTHER",
} as const;
export type SettlementType = (typeof SettlementType)[keyof typeof SettlementType];
