"use client";

export type GuardianForm = {
  fullName: string;
  relationship: string;
  phone: string;
  nationalId: string;
};

export type PatientForm = {
  fullName: string;
  dob: string;
  gender: string;
  phone: string;
  address: string;
  nationalId: string;
  patientType: "ADULT" | "CHILD";
  guardian: GuardianForm;
};

export const emptyPatientForm = (patientType: "ADULT" | "CHILD" = "ADULT"): PatientForm => ({
  fullName: "",
  dob: "",
  gender: "",
  phone: "",
  address: "",
  nationalId: "",
  patientType,
  guardian: { fullName: "", relationship: "", phone: "", nationalId: "" },
});

/** The body POST /api/patients expects. */
export function toPatientPayload(form: PatientForm) {
  return {
    fullName: form.fullName.trim(),
    dob: form.dob || null,
    gender: form.gender || null,
    phone: form.phone || null,
    address: form.address || null,
    nationalId: form.nationalId || null,
    patientType: form.patientType,
    guardian:
      form.patientType === "CHILD" && form.guardian.fullName
        ? {
            fullName: form.guardian.fullName.trim(),
            relationship: form.guardian.relationship || null,
            phone: form.guardian.phone || null,
            nationalId: form.guardian.nationalId || null,
          }
        : null,
  };
}

/**
 * Patient registration fields, shared by the «مريض جديد» page and the quick-add
 * modal. `framed` puts each section in its own card (full page); otherwise the
 * sections are stacked compactly for a modal.
 */
export function PatientFields({
  form,
  onChange,
  framed = false,
}: {
  form: PatientForm;
  onChange: (form: PatientForm) => void;
  framed?: boolean;
}) {
  const set = (field: keyof Omit<PatientForm, "guardian">, value: string) => onChange({ ...form, [field]: value });
  const setGuardian = (field: keyof GuardianForm, value: string) =>
    onChange({ ...form, guardian: { ...form.guardian, [field]: value } });

  const section = framed ? "card p-5" : "";
  const heading = framed ? "font-semibold text-gray-900 mb-4" : "text-sm font-semibold text-gray-700 mb-2";
  const grid = framed ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : "grid grid-cols-1 sm:grid-cols-2 gap-3";

  return (
    <>
      {/* Patient type */}
      <div className={section}>
        <h2 className={heading}>نوع المريض</h2>
        <div className="flex gap-4">
          {(["ADULT", "CHILD"] as const).map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="patientType"
                value={t}
                checked={form.patientType === t}
                onChange={() => set("patientType", t)}
                className="accent-primary-600"
              />
              <span className="text-sm font-medium">{t === "ADULT" ? "بالغ" : "طفل"}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Personal info */}
      <div className={section}>
        <h2 className={heading}>البيانات الشخصية</h2>
        <div className={grid}>
          <div className="sm:col-span-2">
            <label className="label">
              الاسم الكامل <span className="text-red-500">*</span>
            </label>
            <input
              required
              minLength={2}
              autoFocus={!framed}
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              className="input"
              placeholder="الاسم الكامل للمريض"
            />
          </div>
          <div>
            <label className="label">تاريخ الميلاد</label>
            <input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">الجنس</label>
            <select value={form.gender} onChange={(e) => set("gender", e.target.value)} className="input">
              <option value="">— اختر —</option>
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </div>
          <div>
            <label className="label">رقم الهاتف</label>
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className="input"
              placeholder="05xxxxxxxx"
              dir="ltr"
            />
          </div>
          <div>
            <label className="label">رقم الهوية</label>
            <input value={form.nationalId} onChange={(e) => set("nationalId", e.target.value)} className="input" dir="ltr" />
          </div>
          {framed && (
            <div className="sm:col-span-2">
              <label className="label">العنوان</label>
              <input value={form.address} onChange={(e) => set("address", e.target.value)} className="input" />
            </div>
          )}
        </div>
      </div>

      {/* Guardian (children only) */}
      {form.patientType === "CHILD" && (
        <div className={section}>
          <h2 className={heading}>بيانات ولي الأمر</h2>
          <div className={grid}>
            <div className="sm:col-span-2">
              <label className="label">
                اسم ولي الأمر <span className="text-red-500">*</span>
              </label>
              <input
                required
                minLength={2}
                value={form.guardian.fullName}
                onChange={(e) => setGuardian("fullName", e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">صلة القرابة</label>
              <select
                value={form.guardian.relationship}
                onChange={(e) => setGuardian("relationship", e.target.value)}
                className="input"
              >
                <option value="">— اختر —</option>
                <option value="father">أب</option>
                <option value="mother">أم</option>
                <option value="sibling">أخ / أخت</option>
                <option value="other">أخرى</option>
              </select>
            </div>
            <div>
              <label className="label">هاتف ولي الأمر</label>
              <input value={form.guardian.phone} onChange={(e) => setGuardian("phone", e.target.value)} className="input" dir="ltr" />
            </div>
            {framed && (
              <div>
                <label className="label">رقم هوية ولي الأمر</label>
                <input
                  value={form.guardian.nationalId}
                  onChange={(e) => setGuardian("nationalId", e.target.value)}
                  className="input"
                  dir="ltr"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
