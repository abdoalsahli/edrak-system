"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { readApiError } from "@/lib/apiError";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionTabs, FUNDS_TABS } from "@/components/ui/SectionTabs";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { VoucherModal } from "@/components/finance/VoucherModal";
import { ArrowLeftRight, Wallet, Landmark } from "lucide-react";

type CashAccount = {
  id: string;
  ledgerAccountId: string;
  name: string;
  type: "CASH" | "BANK";
  accountNumber: string | null;
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  balance: number;
  isActive: boolean;
};

const money = (n: number) => `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.ل`;

/** الصناديق والبنوك — each box is a ledger account; its statement is the account statement. */
export default function CashPage() {
  const [rows, setRows] = useState<CashAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [transfer, setTransfer] = useState(false);

  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"CASH" | "BANK">("CASH");
  const [accountNumber, setAccountNumber] = useState("");
  const [openingBalance, setOpeningBalance] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/finance/cash-accounts");
    if (res.ok) {
      const d = await res.json();
      setRows(d.data);
      setTotal(d.totals.balance);
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const res = await fetch("/api/finance/cash-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, accountNumber: accountNumber || undefined, openingBalance: Number(openingBalance) || 0 }),
    });
    if (!res.ok) setError(await readApiError(res));
    else {
      setModal(false);
      setName(""); setAccountNumber(""); setOpeningBalance(""); setType("CASH");
      load();
    }
    setSaving(false);
  }

  if (loading) return <div className="text-gray-400 p-8 text-center">جارٍ التحميل...</div>;

  return (
    <div>
      <PageHeader
        title="الصناديق وطرق الدفع"
        description="كل صندوق حساب في الدليل — رصيده وكشفه من دفتر القيود"
        action={
          <div className="flex gap-2">
            <button onClick={() => setTransfer(true)} className="btn-secondary text-sm"><ArrowLeftRight className="size-4" />تحويل بين صندوقين</button>
            <button onClick={() => { setError(""); setModal(true); }} className="btn-primary text-sm">+ صندوق جديد</button>
          </div>
        }
      />
      <SectionTabs tabs={FUNDS_TABS} />

      <div className="mb-6 inline-block min-w-[18rem] rounded-card bg-gradient-primary p-5 text-white shadow-card">
        <p className="text-sm opacity-80">إجمالي النقد في الصناديق النشطة</p>
        <p className="mt-1 text-3xl font-bold">{money(total)}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rows.map((a) => (
          <div key={a.id} className={`card p-5 ${!a.isActive ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`grid size-10 place-items-center rounded-full ${a.type === "CASH" ? "bg-green-100 text-green-500" : "bg-primary-100 text-primary-600"}`}>{a.type === "CASH" ? <Wallet className="size-5" /> : <Landmark className="size-5" />}</span>
                  <h3 className="font-semibold text-gray-900">{a.name}</h3>
                  {!a.isActive && <Badge variant="gray">معطّل</Badge>}
                </div>
                {a.accountNumber && <p className="text-xs text-gray-400 mt-0.5" dir="ltr">{a.accountNumber}</p>}
              </div>
              <div className="text-left">
                <p className="text-xs text-gray-500">الرصيد</p>
                <p className={`text-xl font-bold ${a.balance >= 0 ? "text-primary-700" : "text-red-600"}`} dir="ltr">{money(a.balance)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-gray-100">
              <div>
                <p className="text-gray-400">إجمالي الوارد</p>
                <p className="font-medium text-green-700" dir="ltr">{money(a.totalIn)}</p>
              </div>
              <div>
                <p className="text-gray-400">إجمالي الصادر</p>
                <p className="font-medium text-red-600" dir="ltr">{money(a.totalOut)}</p>
              </div>
            </div>
            <Link href={`/finance/accounts/${a.ledgerAccountId}`} className="block text-sm text-primary-600 hover:underline mt-3">
              كشف {a.type === "CASH" ? "الصندوق" : "الحساب"} ←
            </Link>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        الوارد يشمل سندات القبض والتحويلات الواردة والرصيد الافتتاحي. لتسجيل عجز أو زيادة عند الجرد استخدم «تسوية» على الصندوق.
      </p>

      <VoucherModal open={transfer} kind="settlement" onClose={() => setTransfer(false)}
        onDone={(doc) => { load(); if (doc.voucherNumber) alert(`تم ترحيل التحويل رقم ${doc.voucherNumber}`); }} />

      <Modal open={modal} onClose={() => setModal(false)} title="صندوق / حساب بنكي جديد">
        <form onSubmit={create} className="space-y-4">
          <div>
            <label className="label">الاسم <span className="text-red-500">*</span></label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="صندوق الاستقبال" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">النوع</label>
              <select value={type} onChange={(e) => setType(e.target.value as "CASH" | "BANK")} className="input">
                <option value="CASH">صندوق نقدي</option>
                <option value="BANK">حساب بنكي</option>
              </select>
            </div>
            <div>
              <label className="label">الرصيد الافتتاحي</label>
              <input type="number" step="0.01" value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value === "" ? "" : parseFloat(e.target.value))}
                className="input" dir="ltr" placeholder="0.00" />
            </div>
          </div>
          {type === "BANK" && (
            <div>
              <label className="label">رقم الحساب / الآيبان</label>
              <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="input" dir="ltr" />
            </div>
          )}
          <p className="text-xs text-gray-400">يُسجَّل الرصيد الافتتاحي قيداً في كشف الصندوق، ولا يُعدَّل بعد الإنشاء — أي فرق لاحق يُسجَّل بتسوية.</p>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "جارٍ الحفظ..." : "حفظ"}</button>
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">إلغاء</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
