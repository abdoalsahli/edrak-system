"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { readApiError } from "@/lib/apiError";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { balanceTone } from "@/lib/balanceTone";

type Kind = "PATIENT" | "THERAPIST" | "EXPENSE" | "CUSTOM";
type Nature = "DEBIT" | "CREDIT";

type Account = {
  id: string;
  code: string;
  name: string;
  kind: Kind;
  nature: Nature;
  isActive: boolean;
  debit: number;
  credit: number;
  balance: number;
};

const KIND_TABS: { key: "" | Kind; label: string }[] = [
  { key: "", label: "الكل" },
  { key: "PATIENT", label: "الحالات" },
  { key: "THERAPIST", label: "الأخصائيون" },
  { key: "EXPENSE", label: "المصروفات" },
  { key: "CUSTOM", label: "حسابات عامة" },
];

const KIND_AR: Record<Kind, string> = { PATIENT: "حالة", THERAPIST: "أخصائي", EXPENSE: "مصروف", CUSTOM: "عام" };

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AccountsPage() {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<Account[]>([]);
  // A link such as /finance/accounts?kind=PATIENT opens on that tab
  const [kind, setKind] = useState<"" | Kind>((searchParams.get("kind") as Kind | null) ?? "");
  const [q, setQ] = useState("");
  const [inactive, setInactive] = useState(false);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [newKind, setNewKind] = useState<"CUSTOM" | "EXPENSE">("CUSTOM");
  const [nature, setNature] = useState<Nature>("DEBIT");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (kind) qs.set("kind", kind);
    if (q) qs.set("q", q);
    if (inactive) qs.set("inactive", "1");
    const res = await fetch(`/api/ledger/accounts?${qs}`);
    if (res.ok) setRows((await res.json()).data);
    setLoading(false);
  }, [kind, q, inactive]);

  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const res = await fetch("/api/ledger/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, kind: newKind, nature, notes: notes || undefined }),
    });
    if (!res.ok) {
      setError(await readApiError(res));
    } else {
      setModal(false);
      setName(""); setNotes(""); setNature("DEBIT"); setNewKind("CUSTOM");
      load();
    }
    setSaving(false);
  }

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  return (
    <div>
      <PageHeader
        title="الحسابات الجارية"
        description="دليل الحسابات وأرصدتها — كل حساب له كشف تُرحَّل إليه السندات والفواتير والتسويات"
        action={<button onClick={() => { setError(""); setModal(true); }} className="btn-primary text-sm">+ حساب جديد</button>}
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {KIND_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setKind(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${kind === t.key ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            {t.label}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الرمز..." className="input max-w-xs ms-auto text-sm" />
        <label className="flex items-center gap-1.5 text-sm text-gray-600 select-none">
          <input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} className="accent-primary-600" />
          المعطّلة
        </label>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="text-gray-400 p-8 text-center">جارٍ التحميل...</div>
        ) : rows.length === 0 ? (
          <p className="text-gray-400 p-8 text-center text-sm">لا توجد حسابات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-start font-medium" data-card="meta">الرمز</th>
                  <th className="px-4 py-2.5 text-start font-medium" data-card="title">الحساب</th>
                  <th className="px-4 py-2.5 text-start font-medium" data-card="meta">النوع</th>
                  <th className="px-4 py-2.5 text-start font-medium" data-hide-mobile>الطبيعة</th>
                  <th className="px-4 py-2.5 text-start font-medium" data-hide-mobile>مدين</th>
                  <th className="px-4 py-2.5 text-start font-medium" data-hide-mobile>دائن</th>
                  <th className="px-4 py-2.5 text-start font-medium" data-card="amount">الرصيد</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={`border-b border-gray-50 hover:bg-gray-50/60 ${!r.isActive ? "opacity-60" : ""}`}>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500" dir="ltr">{r.code}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/finance/accounts/${r.id}`} className="text-primary-600 hover:underline font-medium">{r.name}</Link>
                      {!r.isActive && <span className="text-xs text-gray-400 ms-2">(معطّل)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{KIND_AR[r.kind]}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.nature === "DEBIT" ? "مدين" : "دائن"}</td>
                    <td className="px-4 py-2.5" dir="ltr">{money(r.debit)}</td>
                    <td className="px-4 py-2.5" dir="ltr">{money(r.credit)}</td>
                    <td className={`px-4 py-2.5 font-semibold ${balanceTone(r.nature, r.balance)}`} dir="ltr">
                      {money(Math.abs(r.balance))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                <tr>
                  <td className="px-4 py-3" colSpan={4}>الإجمالي ({rows.length} حساب)</td>
                  <td className="px-4 py-3" dir="ltr">{money(totalDebit)}</td>
                  <td className="px-4 py-3" dir="ltr">{money(totalCredit)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        حسابات الحالات والأخصائيين تُنشأ تلقائياً مع أصحابها. الحساب <strong>المدين</strong> بطبيعته رصيده = المدين − الدائن (مثل الحالات والمصروفات)،
        و<strong>الدائن</strong> بطبيعته رصيده = الدائن − المدين (مثل الأخصائيين والجهات التي ندين لها).
      </p>

      <Modal open={modal} onClose={() => setModal(false)} title="حساب جديد">
        <form onSubmit={create} className="space-y-4">
          <div>
            <label className="label">اسم الحساب <span className="text-red-500">*</span></label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="مثال: شركة الكهرباء، مؤجّر المبنى، تبرعات" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">النوع</label>
              <select value={newKind} onChange={(e) => setNewKind(e.target.value as "CUSTOM" | "EXPENSE")} className="input">
                <option value="CUSTOM">حساب عام (جهة / مورّد / أخرى)</option>
                <option value="EXPENSE">حساب مصروف</option>
              </select>
            </div>
            <div>
              <label className="label">طبيعة الحساب <span className="text-red-500">*</span></label>
              <select value={nature} onChange={(e) => setNature(e.target.value as Nature)} className="input">
                <option value="DEBIT">مدين — يُتابَع ما علي الطرف</option>
                <option value="CREDIT">دائن — يُتابَع ما للطرف علينا</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">ملاحظات</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" />
          </div>
          <p className="text-xs text-gray-400">طبيعة الحساب لا يمكن تغييرها بعد الإنشاء، لأنها تحدد طريقة قراءة رصيده عبر كل تاريخه.</p>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "جارٍ الحفظ..." : "إنشاء الحساب"}</button>
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">إلغاء</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
