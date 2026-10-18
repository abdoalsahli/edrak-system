"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type PaymentMethodOption = {
  id: string;
  name: string;
  cashAccount: { id: string; name: string; type: "CASH" | "BANK" };
};

/** Active payment methods, in their configured order. */
export function usePaymentMethods() {
  const [methods, setMethods] = useState<PaymentMethodOption[] | null>(null);
  useEffect(() => {
    fetch("/api/finance/payment-methods").then((r) => (r.ok ? r.json() : { data: [] })).then((d) => setMethods(d.data));
  }, []);
  return methods;
}

/**
 * Payment method picker. The box is not chosen here: each method is linked to
 * its own box in «طرق الدفع», and that box is shown read-only next to it.
 * Renders two grid cells (method, box).
 */
export function PaymentMethodField({
  value, onChange, direction = "to", small = false,
}: {
  value: string;
  onChange: (id: string) => void;
  direction?: "to" | "from";
  small?: boolean;
}) {
  const methods = usePaymentMethods();

  // Default to the first method (usually «نقداً»), and drop a selection that no longer exists
  useEffect(() => {
    if (!methods) return;
    if (!methods.some((m) => m.id === value)) onChange(methods[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methods, value]);

  const labelCls = small ? "label text-xs" : "label";
  const inputCls = small ? "input text-sm" : "input";
  const box = methods?.find((m) => m.id === value)?.cashAccount;

  return (
    <>
      <div>
        <label className={labelCls}>طريقة الدفع <span className="text-red-500">*</span></label>
        <select required value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
          {methods && methods.length === 0 && <option value="">— لا توجد طرق دفع —</option>}
          {methods?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {methods && methods.length === 0 && (
          <p className="text-xs text-amber-700 mt-1">
            أضف طريقة دفع من <Link href="/finance/payment-methods" className="underline">«طرق الدفع»</Link>
          </p>
        )}
      </div>
      <div>
        <label className={labelCls}>{direction === "to" ? "إلى صندوق" : "من صندوق"}</label>
        <div className={`${inputCls} bg-gray-50 text-gray-600 truncate`}>
          {box ? `${box.type === "CASH" ? "💵" : "🏦"} ${box.name}` : "—"}
        </div>
      </div>
    </>
  );
}
