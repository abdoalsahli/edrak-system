"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readApiError } from "@/lib/apiError";
import { PageHeader } from "@/components/ui/PageHeader";
import { PatientFields, emptyPatientForm, toPatientPayload, type PatientForm } from "@/components/patients/PatientFields";
import { OpeningBalanceSection, emptyOpening, toOpeningPayload, type OpeningValue } from "@/components/finance/OpeningBalance";

export default function NewPatientPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<PatientForm>(emptyPatientForm());
  const [opening, setOpening] = useState<OpeningValue>(emptyOpening());
  const [canSetOpening, setCanSetOpening] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((s) => setCanSetOpening(s?.user?.role === "MANAGER"));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const res = await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...toPatientPayload(form), openingBalance: canSetOpening ? toOpeningPayload(opening) : null }),
    });

    setSaving(false);

    if (!res.ok) {
      setError(await readApiError(res));
      return;
    }

    const patient = await res.json();
    router.push(`/patients/${patient.id}`);
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="تسجيل حالة جديدة" />

      <form onSubmit={handleSubmit} className="space-y-6">
        <PatientFields form={form} onChange={setForm} framed />
        {canSetOpening && <OpeningBalanceSection who="patient" value={opening} onChange={setOpening} />}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "جارٍ الحفظ..." : "تسجيل الحالة"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary"
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
