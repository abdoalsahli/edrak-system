/**
 * الخطط العلاجية وتقارير المتابعة — the choices of the centre's two forms
 * («خطة الشهر» and «نموذج متابعة شهري»). Shared by the forms, the views and the API.
 */

/** A cycle is four weeks of the program's rhythm: 3 sessions a week → 12 sessions. */
export const CYCLE_WEEKS = 4;
export const cycleSize = (sessionsPerWeek: number) => Math.max(1, sessionsPerWeek * CYCLE_WEEKS);

/** الجوانب النمائية التي ستركز عليها هذا الشهر */
export const FOCUS_AREAS = [
  "اللغة والتواصل",
  "المهارات الاجتماعية",
  "المهارات الحركية الدقيقة",
  "المهارات الحركية الكبرى",
  "الانتباه والتركيز",
  "التنظيم الحسي",
  "الاستقلالية والعناية الذاتية",
];

/** مستوى التقدّم — a key, or the therapist's own words («أخرى») */
export const PROGRESS_LEVELS: Record<string, string> = {
  ACHIEVED: "تحقق بالكامل",
  PARTIAL: "تحقق جزء منها",
  NONE: "لم يتحقق شيء",
};

/** التغيرات الملحوظة */
export const CHANGES = ["اللغة والنطق", "السلوك", "الانتباه", "التفاعل أثناء الجلسة", "التفاعل الاجتماعي"];

/** تنفيذ الأهل للتعليمات والمتابعة */
export const PARENT_COMMITMENT: Record<string, string> = {
  COMMITTED: "ملتزمون",
  PARTIAL: "جزئي",
  NOT_COMMITTED: "غير ملتزمين",
};

/** معوّقات التقدّم */
export const OBSTACLES = ["الشاشات", "كثرة الغياب", "مشاكل أسرية", "ضعف قدرات الطفل", "لا توجد معوقات"];

export const GOAL_ACHIEVEMENT: Record<string, { label: string; variant: "success" | "warning" | "danger" }> = {
  ACHIEVED: { label: "تحقق", variant: "success" },
  PARTIAL: { label: "تحقق جزئياً", variant: "warning" },
  NOT_ACHIEVED: { label: "لم يتحقق", variant: "danger" },
};

export type DocStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "RETURNED";
export const DOC_STATUS: Record<DocStatus, { label: string; variant: "gray" | "info" | "success" | "danger" }> = {
  DRAFT: { label: "مسودة", variant: "gray" },
  SUBMITTED: { label: "بانتظار المراجعة", variant: "info" },
  APPROVED: { label: "معتمد", variant: "success" },
  RETURNED: { label: "أُعيد للتعديل", variant: "danger" },
};

/** «جلسة واحدة»، «جلستان»، «5 جلسات»، «12 جلسة» */
export const sessionsAr = (n: number) =>
  n === 1 ? "جلسة واحدة" : n === 2 ? "جلستان" : n >= 3 && n <= 10 ? `${n} جلسات` : `${n} جلسة`;

/** A stored choice → its label (keys map to the form's wording; free text stays as written). */
export const choiceLabel = (map: Record<string, string>, value: string) => map[value] ?? value;
