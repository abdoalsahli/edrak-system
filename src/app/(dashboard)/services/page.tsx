"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertTriangle, Trash2 } from "lucide-react";
import { readApiError } from "@/lib/apiError";

type Service = {
  id: string;
  name: string;
  description?: string | null;
  deliveryType: "SINGLE_SESSION" | "PROGRAM";
  defaultSessionsPerWeek?: number | null;
  defaultTotalSessions?: number | null;
  defaultDurationMin: number;
  defaultBillingCycleType?: string | null;
  defaultBillingCycleValue?: number | null;
  defaultPrice?: number | null;
  isActive: boolean;
  usage?: number; // sessions + programmes using it
};

const emptyForm = (): Omit<Service, "id" | "isActive"> => ({
  name: "",
  description: "",
  deliveryType: "SINGLE_SESSION",
  defaultDurationMin: 60,
  defaultSessionsPerWeek: null,
  defaultTotalSessions: null,
  defaultBillingCycleType: null,
  defaultBillingCycleValue: null,
  defaultPrice: null,
});

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/services");
    if (res.ok) setServices(await res.json());
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description ?? "",
      deliveryType: s.deliveryType,
      defaultDurationMin: s.defaultDurationMin,
      defaultSessionsPerWeek: s.defaultSessionsPerWeek ?? null,
      defaultTotalSessions: s.defaultTotalSessions ?? null,
      defaultBillingCycleType: s.defaultBillingCycleType ?? null,
      defaultBillingCycleValue: s.defaultBillingCycleValue ?? null,
      defaultPrice: s.defaultPrice ?? null,
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const url = editing ? `/api/services/${editing.id}` : "/api/services";
    const method = editing ? "PATCH" : "POST";
    const payload = {
      ...form,
      description: form.description || null,
      defaultSessionsPerWeek: form.deliveryType === "PROGRAM" ? form.defaultSessionsPerWeek : null,
      defaultTotalSessions: form.deliveryType === "PROGRAM" ? form.defaultTotalSessions : null,
      defaultBillingCycleType: form.deliveryType === "PROGRAM" ? form.defaultBillingCycleType : null,
      defaultBillingCycleValue: form.deliveryType === "PROGRAM" ? form.defaultBillingCycleValue : null,
    };
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function remove(s: Service) {
    if (!confirm(`حذف الخدمة «${s.name}» نهائياً؟`)) return;
    const res = await fetch(`/api/services/${s.id}`, { method: "DELETE" });
    if (!res.ok) alert(await readApiError(res, "تعذّر حذف الخدمة"));
    load();
  }

  async function toggleActive(s: Service) {
    await fetch(`/api/services/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    load();
  }

  function set(field: string, value: unknown) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  return (
    <div>
      <PageHeader
        title="الخدمات"
        description="إدارة الخدمات المقدمة في المركز"
        action={<button onClick={openNew} className="btn-primary">+ إضافة خدمة</button>}
      />

      {services.some((s) => s.isActive && !(s.defaultPrice != null && Number(s.defaultPrice) > 0)) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
          <AlertTriangle className="inline size-4 align-[-3px]" /> بعض الخدمات النشطة <strong>بدون سعر</strong> — أي جلسة أو برنامج يستخدمها سيُنشئ فاتورة
          بقيمة <strong>صفر</strong>. حدّد السعر لكل خدمة، ثم استخدم زر «↻ إعادة حساب» على الفواتير المتأثرة.
        </div>
      )}

      <div className="card">
        {services.length === 0 ? (
          <EmptyState title="لا توجد خدمات" action={<button onClick={openNew} className="btn-primary">إضافة خدمة</button>} />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>الخدمة</Th>
                <Th>النوع</Th>
                <Th>السعر</Th>
                <Th>مدة الجلسة</Th>
                <Th>جلسات البرنامج</Th>
                <Th>الحالة</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {services.map((s) => (
                <Tr key={s.id}>
                  <Td>
                    <div className="font-medium text-gray-900">{s.name}</div>
                    {s.description && <div className="text-xs text-gray-400">{s.description}</div>}
                  </Td>
                  <Td>
                    <Badge variant={s.deliveryType === "PROGRAM" ? "info" : "gray"}>
                      {s.deliveryType === "PROGRAM" ? "برنامج" : "جلسة فردية"}
                    </Badge>
                  </Td>
                  <Td>
                    {s.defaultPrice != null && Number(s.defaultPrice) > 0 ? (
                      <span className="font-medium" dir="ltr">{Number(s.defaultPrice).toFixed(2)} د.ل</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        <span className="inline-flex items-center gap-1"><AlertTriangle className="size-3.5" />بدون سعر</span>
                      </span>
                    )}
                  </Td>
                  <Td>{s.defaultDurationMin} دقيقة</Td>
                  <Td>{s.deliveryType === "PROGRAM" ? `${s.defaultTotalSessions ?? "—"} جلسة (${s.defaultSessionsPerWeek ?? "—"}/أسبوع)` : "—"}</Td>
                  <Td><Badge variant={s.isActive ? "success" : "gray"}>{s.isActive ? "نشطة" : "معطلة"}</Badge></Td>
                  <Td>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(s)} className="text-primary-600 hover:underline text-xs">تعديل</button>
                      <button onClick={() => toggleActive(s)} className="text-gray-500 hover:underline text-xs">
                        {s.isActive ? "تعطيل" : "تفعيل"}
                      </button>
                      {/* Only a service nothing refers to can go; a used one is disabled instead */}
                      {s.usage === 0 ? (
                        <button onClick={() => remove(s)} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline">
                          <Trash2 className="size-3.5" />حذف
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400" title="مستخدمة في جلسات أو برامج — يمكن تعطيلها فقط">مستخدمة ({s.usage})</span>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "تعديل الخدمة" : "إضافة خدمة جديدة"} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">اسم الخدمة <span className="text-red-500">*</span></label>
              <input required value={form.name} onChange={(e) => set("name", e.target.value)} className="input" />
            </div>
            <div className="col-span-2">
              <label className="label">الوصف</label>
              <input value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">نوع التقديم</label>
              <select value={form.deliveryType} onChange={(e) => set("deliveryType", e.target.value)} className="input">
                <option value="SINGLE_SESSION">جلسة فردية</option>
                <option value="PROGRAM">برنامج</option>
              </select>
            </div>
            <div>
              <label className="label">مدة الجلسة (دقيقة)</label>
              <input type="number" min={15} value={form.defaultDurationMin} onChange={(e) => set("defaultDurationMin", parseInt(e.target.value))} className="input" />
            </div>
            {form.deliveryType === "PROGRAM" && (
              <>
                <div>
                  <label className="label">جلسات في الأسبوع</label>
                  <input type="number" min={1} max={7} value={form.defaultSessionsPerWeek ?? ""} onChange={(e) => set("defaultSessionsPerWeek", e.target.value ? parseInt(e.target.value) : null)} className="input" />
                </div>
                <div>
                  <label className="label">إجمالي الجلسات</label>
                  <input type="number" min={1} value={form.defaultTotalSessions ?? ""} onChange={(e) => set("defaultTotalSessions", e.target.value ? parseInt(e.target.value) : null)} className="input" />
                </div>
                <div>
                  <label className="label">دورة الفوترة</label>
                  <select value={form.defaultBillingCycleType ?? ""} onChange={(e) => set("defaultBillingCycleType", e.target.value || null)} className="input">
                    <option value="">— اختر —</option>
                    <option value="MONTHLY">شهري</option>
                    <option value="PER_N_SESSIONS">كل N جلسة</option>
                  </select>
                </div>
                {form.defaultBillingCycleType === "PER_N_SESSIONS" && (
                  <div>
                    <label className="label">عدد الجلسات لكل دورة</label>
                    <input type="number" min={1} value={form.defaultBillingCycleValue ?? ""} onChange={(e) => set("defaultBillingCycleValue", e.target.value ? parseInt(e.target.value) : null)} className="input" />
                  </div>
                )}
              </>
            )}

            {/* Price applies to every service type — a service without a price
                produces zero-value invoices. */}
            <div className="col-span-2">
              <label className="label">
                سعر الجلسة (د.ل) <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="number"
                min={0.01}
                step="0.01"
                value={form.defaultPrice ?? ""}
                onChange={(e) => set("defaultPrice", e.target.value ? parseFloat(e.target.value) : null)}
                className="input"
                dir="ltr"
                placeholder="مثال: 200"
              />
              <p className="text-xs text-gray-400 mt-1">
                {form.deliveryType === "PROGRAM"
                  ? "سعر الجلسة الواحدة — تُحسب قيمة البرنامج = السعر × عدد الجلسات"
                  : "بدون سعر لن تُصدر فاتورة بقيمة لهذه الخدمة"}
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "جارٍ الحفظ..." : "حفظ"}</button>
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">إلغاء</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
