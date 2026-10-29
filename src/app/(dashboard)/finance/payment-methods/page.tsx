"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { readApiError } from "@/lib/apiError";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionTabs, FUNDS_TABS } from "@/components/ui/SectionTabs";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";

type Box = { id: string; name: string; type: "CASH" | "BANK"; isActive: boolean };
type Method = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  cashAccount: Box;
  usage: number;
  totalIn: number;
  totalOut: number;
};

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const boxLabel = (b: Box) => `${b.name} — ${b.type === "CASH" ? "صندوق نقدي" : "حساب بنكي"}`;

/** طرق الدفع — each method is linked to the box its money moves through. */
export default function PaymentMethodsPage() {
  const [rows, setRows] = useState<Method[]>([]);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Method | "new" | null>(null);
  const [name, setName] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [m, b] = await Promise.all([
      fetch("/api/finance/payment-methods?all=1").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/finance/cash-accounts").then((r) => (r.ok ? r.json() : { data: [] })),
    ]);
    setRows(m.data);
    setBoxes(b.data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const activeBoxes = boxes.filter((b) => b.isActive);

  function openNew() {
    setEditing("new"); setName(""); setError("");
    setCashAccountId(activeBoxes[0]?.id ?? "");
  }
  function openEdit(m: Method) {
    setEditing(m); setName(m.name); setError("");
    setCashAccountId(m.cashAccount.id);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const isNew = editing === "new";
    const res = await fetch(isNew ? "/api/finance/payment-methods" : `/api/finance/payment-methods/${(editing as Method).id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, cashAccountId }),
    });
    if (!res.ok) setError(await readApiError(res));
    else { setEditing(null); load(); }
    setSaving(false);
  }

  async function patch(id: string, body: object) {
    const res = await fetch(`/api/finance/payment-methods/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) alert(await readApiError(res));
    return res.ok;
  }

  async function move(i: number, dir: -1 | 1) {
    const a = rows[i], b = rows[i + dir];
    if (!a || !b) return;
    // Swap positions; fall back to the index when two methods share a sort order
    const sa = a.sortOrder === b.sortOrder ? i : a.sortOrder;
    const sb = a.sortOrder === b.sortOrder ? i + dir : b.sortOrder;
    await patch(a.id, { sortOrder: sb });
    await patch(b.id, { sortOrder: sa });
    load();
  }

  async function remove(m: Method) {
    if (!confirm(`حذف طريقة الدفع «${m.name}»؟`)) return;
    const res = await fetch(`/api/finance/payment-methods/${m.id}`, { method: "DELETE" });
    if (!res.ok) alert(await readApiError(res));
    load();
  }

  if (loading) return <div className="text-gray-400 p-8 text-center">جارٍ التحميل...</div>;

  return (
    <div>
      <PageHeader
        title="الصناديق وطرق الدفع"
        description="كل طريقة دفع مرتبطة بصندوقها — عند اختيارها في سند قبض أو صرف تُرحَّل القيمة إلى ذلك الصندوق تلقائياً"
        action={<button onClick={openNew} className="btn-primary text-sm">+ طريقة دفع</button>}
      />
      <SectionTabs tabs={FUNDS_TABS} />

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <p className="text-gray-400 p-8 text-center text-sm">لا توجد طرق دفع — أضف «نقداً» واربطها بالصندوق النقدي</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-start font-medium w-16">الترتيب</th>
                  <th className="px-4 py-2.5 text-start font-medium">طريقة الدفع</th>
                  <th className="px-4 py-2.5 text-start font-medium">الصندوق المرتبط</th>
                  <th className="px-4 py-2.5 text-start font-medium">المقبوض</th>
                  <th className="px-4 py-2.5 text-start font-medium">المصروف</th>
                  <th className="px-4 py-2.5 text-start font-medium">الحالة</th>
                  <th className="px-4 py-2.5 text-start font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m, i) => (
                  <tr key={m.id} className={`border-b border-gray-50 hover:bg-gray-50/60 ${!m.isActive ? "opacity-60" : ""}`}>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <button onClick={() => move(i, -1)} disabled={i === 0} className="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="أعلى">▲</button>
                      <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="أسفل">▼</button>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{m.name}</td>
                    <td className="px-4 py-2.5">
                      {boxLabel(m.cashAccount)}
                      {!m.cashAccount.isActive && <span className="text-xs text-red-600 ms-2">(الصندوق معطّل)</span>}
                    </td>
                    <td className="px-4 py-2.5" dir="ltr">
                      <Link href={`/finance/receipts?paymentMethodId=${m.id}`} className="text-green-700 hover:underline">{money(m.totalIn)}</Link>
                    </td>
                    <td className="px-4 py-2.5" dir="ltr">
                      <Link href={`/finance/vouchers?paymentMethodId=${m.id}`} className="text-red-600 hover:underline">{money(m.totalOut)}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      {m.isActive ? <Badge variant="success">مفعّلة</Badge> : <Badge variant="gray">معطّلة</Badge>}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs">
                      <button onClick={() => openEdit(m)} className="text-primary-600 hover:underline me-3">تعديل</button>
                      <button onClick={async () => { if (await patch(m.id, { isActive: !m.isActive })) load(); }}
                        className="text-gray-600 hover:underline me-3">
                        {m.isActive ? "تعطيل" : "تفعيل"}
                      </button>
                      {m.usage === 0 && <button onClick={() => remove(m)} className="text-red-600 hover:underline">حذف</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        تغيير الصندوق المرتبط يسري على المستندات الجديدة فقط؛ المستندات السابقة تبقى في صندوقها.
        طريقة الدفع المستخدمة في مستندات لا تُحذف — يمكن تعطيلها.
      </p>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "طريقة دفع جديدة" : "تعديل طريقة الدفع"}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">الاسم <span className="text-red-500">*</span></label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="مثال: موبي كاش" />
          </div>
          <div>
            <label className="label">الصندوق المرتبط <span className="text-red-500">*</span></label>
            <select required value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)} className="input">
              <option value="">— اختر —</option>
              {activeBoxes.map((b) => <option key={b.id} value={b.id}>{boxLabel(b)}</option>)}
            </select>
            {activeBoxes.length === 0 && (
              <p className="text-xs text-amber-700 mt-1">
                لا توجد صناديق — أنشئ صندوقاً من <Link href="/finance/cash" className="underline">«الصناديق والبنوك»</Link>
              </p>
            )}
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "جارٍ الحفظ..." : "حفظ"}</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-secondary">إلغاء</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
