"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoginCard } from "@/components/staff/LoginCard";
import { readApiError } from "@/lib/apiError";

type Employee = { id: string; fullName: string; jobTitle: string | null; phone: string | null; isActive: boolean };

export default function EmployeePage() {
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Remount the login card when activation changes — stopping an employee disables the login
  const [loginKey, setLoginKey] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch(`/api/employees/${id}`);
    if (!res.ok) { setError(await readApiError(res, "تعذّر تحميل الموظف")); return; }
    const e: Employee = await res.json();
    setEmployee(e);
    setFullName(e.fullName);
    setJobTitle(e.jobTitle ?? "");
    setPhone(e.phone ?? "");
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function patch(body: object, done: string) {
    setSaving(true); setError(""); setNotice("");
    const res = await fetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) { setError(await readApiError(res)); return; }
    await load();
    setLoginKey((k) => k + 1);
    setNotice(done);
  }

  if (!employee) {
    return error
      ? <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
      : <div className="text-gray-400 p-8 text-center">جارٍ التحميل...</div>;
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={employee.fullName}
        description={employee.jobTitle ?? "موظف إداري"}
        action={
          <button
            onClick={() => patch({ isActive: !employee.isActive }, employee.isActive ? "✓ أُوقف الموظف وعُطّل دخوله" : "✓ فُعّل الموظف")}
            disabled={saving}
            className={employee.isActive ? "btn-secondary" : "btn-primary"}
          >
            {employee.isActive ? "إيقاف الموظف" : "تفعيل الموظف"}
          </button>
        }
      />

      <LoginCard
        key={loginKey}
        url={`/api/employees/${id}/login`}
        description="يدخل به الموظف إلى النظام، ويرى الأقسام التي تسمح بها صلاحيته فقط."
        withRole
      />

      <form
        onSubmit={(e) => { e.preventDefault(); patch({ fullName, jobTitle: jobTitle || null, phone: phone || null }, "✓ حُفظت البيانات"); }}
        className="space-y-6"
      >
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">بيانات الموظف</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">الاسم الكامل</label>
              <input required minLength={2} value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">الوظيفة</label>
              <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">الهاتف</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" dir="ltr" />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
        {notice && <p className="text-sm text-green-700 bg-green-50 px-4 py-2 rounded-lg">{notice}</p>}
        <button type="submit" disabled={saving} className="btn-primary">{saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}</button>
      </form>
    </div>
  );
}
