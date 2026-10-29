/**
 * قوالب التسوية — the everyday settlements, each with its direction fixed so
 * nobody has to think in debit and credit. The «main» account is the one the
 * settlement is about (the patient, the therapist, the box); the «counter»
 * account is the other side, often optional.
 *
 * A side is where the amount goes: «from» is credited, «to» is debited.
 */

export type AccountKind = "PATIENT" | "THERAPIST" | "EXPENSE" | "CUSTOM" | "CASH";
export type SettlementType = "DISCOUNT" | "WRITE_OFF" | "CORRECTION" | "TRANSFER" | "OTHER";
export type Side = "from" | "to";

export type SettlementTemplate = {
  key: string;
  label: string;
  /** What it does, in a sentence */
  hint: string;
  type: SettlementType;
  /** With both accounts, the statement reads «<verb> من <main> إلى <counter>» */
  verb?: string;
  main: { label: string; kinds: AccountKind[]; side: Side };
  counter: { label: string; kinds: AccountKind[]; required: boolean };
};

const ANY: AccountKind[] = ["PATIENT", "THERAPIST", "EXPENSE", "CUSTOM", "CASH"];
const OTHER_SIDE: AccountKind[] = ["EXPENSE", "CUSTOM"];

export const SETTLEMENT_TEMPLATES: SettlementTemplate[] = [
  {
    key: "patient_discount", label: "خصم لمريض", type: "DISCOUNT",
    hint: "ينقص المستحق على المريض بقيمة الخصم.",
    main: { label: "المريض", kinds: ["PATIENT"], side: "from" },
    counter: { label: "حساب الخصومات", kinds: OTHER_SIDE, required: false },
  },
  {
    key: "patient_write_off", label: "إعدام دين مريض", type: "WRITE_OFF",
    hint: "يُسقط مبلغاً لن يُحصَّل من المستحق على المريض.",
    main: { label: "المريض", kinds: ["PATIENT"], side: "from" },
    counter: { label: "حساب الديون المعدومة", kinds: OTHER_SIDE, required: false },
  },
  {
    key: "patient_charge", label: "رسوم إضافية على مريض", type: "OTHER",
    hint: "يزيد المستحق على المريض (رسوم أو قيمة لم تُقيَّد).",
    main: { label: "المريض", kinds: ["PATIENT"], side: "to" },
    counter: { label: "حساب الإيراد", kinds: OTHER_SIDE, required: false },
  },
  {
    key: "therapist_deduct", label: "خصم من مستحقات أخصائي", type: "DISCOUNT",
    hint: "ينقص ما يستحقه الأخصائي (غرامة، استرداد سلفة، تصحيح عمولة زائدة).",
    main: { label: "الأخصائي", kinds: ["THERAPIST"], side: "to" },
    counter: { label: "الحساب المقابل", kinds: OTHER_SIDE, required: false },
  },
  {
    key: "therapist_add", label: "إضافة لمستحقات أخصائي", type: "OTHER",
    hint: "يزيد ما يستحقه الأخصائي (مكافأة، عمولة ناقصة، مصروف دفعه عن المركز).",
    main: { label: "الأخصائي", kinds: ["THERAPIST"], side: "from" },
    counter: { label: "حساب المصروف", kinds: OTHER_SIDE, required: false },
  },
  {
    key: "cash_transfer", label: "تحويل بين صندوقين / إيداع في البنك", type: "TRANSFER", verb: "تحويل",
    hint: "ينقل مبلغاً من صندوق إلى صندوق أو حساب بنكي.",
    main: { label: "من صندوق", kinds: ["CASH"], side: "from" },
    counter: { label: "إلى صندوق", kinds: ["CASH"], required: true },
  },
  {
    key: "profit_withdrawal", label: "سحب أرباح من صندوق", type: "OTHER", verb: "سحب أرباح",
    hint: "يُخرج مبلغاً من الصندوق إلى حساب الأرباح.",
    main: { label: "من صندوق", kinds: ["CASH"], side: "from" },
    counter: { label: "إلى حساب", kinds: ["CUSTOM"], required: true },
  },
  {
    key: "cash_shortage", label: "عجز صندوق", type: "CORRECTION",
    hint: "الموجود فعلاً في الصندوق أقل من رصيده — ينقص رصيده بالفرق.",
    main: { label: "الصندوق", kinds: ["CASH"], side: "from" },
    counter: { label: "حساب العجز", kinds: OTHER_SIDE, required: false },
  },
  {
    key: "cash_surplus", label: "زيادة صندوق", type: "CORRECTION",
    hint: "الموجود فعلاً في الصندوق أكثر من رصيده — يزيد رصيده بالفرق.",
    main: { label: "الصندوق", kinds: ["CASH"], side: "to" },
    counter: { label: "الحساب المقابل", kinds: OTHER_SIDE, required: false },
  },
  {
    key: "free", label: "قيد حر (متقدم)", type: "OTHER",
    hint: "ينتقل المبلغ من الحساب الأول إلى الثاني — راجع الأثر تحت كل حساب.",
    main: { label: "من حساب", kinds: ANY, side: "from" },
    counter: { label: "إلى حساب", kinds: ANY, required: false },
  },
];

export const FREE_TYPES: [SettlementType, string][] = [
  ["DISCOUNT", "خصم"],
  ["WRITE_OFF", "إعدام دين"],
  ["CORRECTION", "تصحيح / عجز أو زيادة جرد"],
  ["TRANSFER", "تحويل بين حسابين"],
  ["OTHER", "أخرى"],
];
