"use client";

import { useEffect, useState } from "react";
import { readApiError } from "@/lib/apiError";
import { Modal } from "@/components/ui/Modal";
import { PatientFields, emptyPatientForm, toPatientPayload, type PatientForm } from "./PatientFields";

export type CreatedPatient = { id: string; fullName: string; patientType: "ADULT" | "CHILD" };

/**
 * Register a patient without leaving the booking screen. The essentials only —
 * address and guardian ID can be completed later from the patient's file.
 */
export function NewPatientModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (patient: CreatedPatient) => void;
}) {
  const [form, setForm] = useState<PatientForm>(emptyPatientForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) { setForm(emptyPatientForm()); setError(""); }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // This form sits (via a portal) inside the booking form — keep its submit to itself
    e.stopPropagation();
    setSaving(true); setError("");
    const res = await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPatientPayload(form)),
    });
    setSaving(false);
    if (!res.ok) { setError(await readApiError(res)); return; }
    const p = await res.json();
    onCreated({ id: p.id, fullName: p.fullName, patientType: p.patientType });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="مريض جديد" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <PatientFields form={form} onChange={setForm} />
        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "جارٍ الحفظ..." : "حفظ واختيار المريض"}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">إلغاء</button>
        </div>
      </form>
    </Modal>
  );
}
