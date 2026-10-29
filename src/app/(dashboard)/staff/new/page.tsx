"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { readApiError } from "@/lib/apiError";
import { EMPLOYEE_ROLES, EMPLOYEE_ROLE_INFO, type EmployeeRole } from "@/lib/staff";

export default function NewEmployeePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [withLogin, setWithLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<EmployeeRole>("RECEPTIONIST");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        jobTitle: jobTitle || null,
        phone: phone || null,
        login: withLogin ? { email, password, role } : null,
      }),
    });
    if (!res.ok) {
      setError(await readApiError(res));
      setSaving(false);
      return;
    }
    const employee = await res.json();
    router.push(`/staff/${employee.id}`);
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="إضافة موظف" description="موظف إداري — للمعالجين استخدم «إضافة معالج»" />
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">بيانات الموظف</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">الاسم الكامل <span className="text-red-500">*</span></label>
              <input required minLength={2} value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">الوظيفة</label>
              <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="input" placeholder="مثال: موظف استقبال" />
            </div>
            <div>
              <label className="label">الهاتف</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" dir="ltr" />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <label className="flex items-center gap-2 font-semibold text-gray-900">
            <input type="checkbox" checked={withLogin} onChange={(e) => setWithLogin(e.target.checked)} className="size-4 accent-primary-600" />
            إنشاء حساب مستخدم
          </label>
          <p className="text-xs text-gray-500 mt-1 mb-4">
            يدخل به الموظف إلى النظام، ويرى الأقسام حسب صلاحيته. يمكن إنشاؤه لاحقاً من صفحة الموظف.
          </p>
          {withLogin && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">البريد الإلكتروني <span className="text-red-500">*</span></label>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" dir="ltr" autoComplete="off" />
              </div>
              <div>
                <label className="label">كلمة المرور <span className="text-red-500">*</span></label>
                <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="input" dir="ltr" autoComplete="new-password" />
              </div>
              <div>
                <label className="label">الصلاحية</label>
                <select value={role} onChange={(e) => setRole(e.target.value as EmployeeRole)} className="input">
                  {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{EMPLOYEE_ROLE_INFO[r].label}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">{EMPLOYEE_ROLE_INFO[role].hint}</p>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "جارٍ الحفظ..." : "إضافة الموظف"}</button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">إلغاء</button>
        </div>
      </form>
    </div>
  );
}
