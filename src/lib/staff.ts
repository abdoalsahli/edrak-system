/** Roles a staff login can have — a THERAPIST login belongs to a therapist record instead. */
export const EMPLOYEE_ROLES = ["MANAGER", "RECEPTIONIST", "ACCOUNTANT"] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

/** What each role can reach — shown next to the role picker. */
export const EMPLOYEE_ROLE_INFO: Record<EmployeeRole, { label: string; hint: string }> = {
  MANAGER: { label: "مدير", hint: "كل أقسام النظام، ومنها الموظفون والخدمات والإعدادات" },
  RECEPTIONIST: { label: "موظف استقبال", hint: "المرضى والجلسات والبرامج العلاجية" },
  ACCOUNTANT: { label: "محاسب", hint: "المالية والسندات والحسابات الجارية والتقارير" },
};
