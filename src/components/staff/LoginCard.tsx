"use client";

import { useCallback, useEffect, useState } from "react";
import { readApiError } from "@/lib/apiError";
import { Badge } from "@/components/ui/Badge";
import { EMPLOYEE_ROLES, EMPLOYEE_ROLE_INFO, type EmployeeRole } from "@/lib/staff";

type Login = { email: string; isActive: boolean; role?: string } | null;

/**
 * حساب المستخدم — the login of a therapist or an employee. `url` is the
 * login route of that record; `withRole` lets the manager pick and change the
 * role (employees — a therapist's login is always THERAPIST).
 */
export function LoginCard({ url, description, withRole = false }: { url: string; description: string; withRole?: boolean }) {
  const [login, setLogin] = useState<Login | undefined>(undefined);
  const [self, setSelf] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<EmployeeRole>("RECEPTIONIST");
  const [resetting, setResetting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(url);
    if (!res.ok) { setError(await readApiError(res, "تعذّر تحميل حساب المستخدم")); return; }
    const data = await res.json();
    setLogin(data.login);
    setSelf(Boolean(data.self));
  }, [url]);
  useEffect(() => { load(); }, [load]);

  async function send(method: "POST" | "PATCH", body: object, done: string) {
    setSaving(true); setError(""); setNotice("");
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { setError(await readApiError(res)); return; }
    const data = await res.json();
    setLogin(data.login);
    setSelf(Boolean(data.self));
    setPassword(""); setResetting(false); setNotice(done);
  }

  if (login === undefined) {
    return error ? <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded mb-6">{error}</p> : null;
  }

  const roleSelect = (value: EmployeeRole, onChange: (r: EmployeeRole) => void, disabled = false) => (
    <div>
      <label className="label">الصلاحية</label>
      <select value={value} onChange={(e) => onChange(e.target.value as EmployeeRole)} className="input" disabled={disabled}>
        {EMPLOYEE_ROLES.map((r) => <option key={r} value={r}>{EMPLOYEE_ROLE_INFO[r].label}</option>)}
      </select>
      <p className="text-xs text-gray-400 mt-1">{EMPLOYEE_ROLE_INFO[value].hint}</p>
    </div>
  );

  return (
    <div className="card p-5 mb-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-gray-900">حساب المستخدم</h2>
        {login && (login.isActive ? <Badge variant="success">مفعّل</Badge> : <Badge variant="gray">معطّل</Badge>)}
      </div>
      <p className="text-xs text-gray-500 mb-4">{description}</p>

      {!login ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send("POST", withRole ? { email, password, role } : { email, password }, "✓ أُنشئ حساب المستخدم — أعطِ صاحبه البريد وكلمة المرور");
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <div>
            <label className="label">البريد الإلكتروني <span className="text-red-500">*</span></label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" dir="ltr" autoComplete="off" />
          </div>
          <div>
            <label className="label">كلمة المرور <span className="text-red-500">*</span></label>
            <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="input" dir="ltr" autoComplete="new-password" />
          </div>
          {withRole && roleSelect(role, setRole)}
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "جارٍ الإنشاء..." : "إنشاء حساب المستخدم"}</button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">البريد: <span className="font-mono" dir="ltr">{login.email}</span></p>
          {withRole && login.role && (
            <div className="max-w-xs">
              {roleSelect(
                login.role as EmployeeRole,
                (r) => send("PATCH", { role: r }, `✓ أصبحت الصلاحية: ${EMPLOYEE_ROLE_INFO[r].label}`),
                saving || self,
              )}
              {self && <p className="text-xs text-amber-600 mt-1">هذا حسابك أنت — لا يمكنك تغيير صلاحيته أو تعطيله.</p>}
            </div>
          )}
          {resetting ? (
            <form onSubmit={(e) => { e.preventDefault(); send("PATCH", { password }, "✓ تم تغيير كلمة المرور"); }} className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="label">كلمة المرور الجديدة</label>
                <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="input" dir="ltr" autoComplete="new-password" />
              </div>
              <button type="submit" disabled={saving} className="btn-primary">حفظ</button>
              <button type="button" onClick={() => { setResetting(false); setPassword(""); }} className="btn-secondary">إلغاء</button>
            </form>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={() => setResetting(true)} className="btn-secondary text-sm">تغيير كلمة المرور</button>
              {!self && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => send("PATCH", { isActive: !login.isActive }, login.isActive ? "✓ عُطّل الدخول" : "✓ فُعّل الدخول")}
                  className={login.isActive ? "btn-secondary text-sm" : "btn-primary text-sm"}
                >
                  {login.isActive ? "تعطيل الدخول" : "تفعيل الدخول"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded mt-3">{error}</p>}
      {notice && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded mt-3">{notice}</p>}
    </div>
  );
}
