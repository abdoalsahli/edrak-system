"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";

type Setting = { key: string; value: string };

const KEYS: Record<string, string> = {
  center_name: "اسم المركز",
  center_phone: "هاتف المركز",
  center_address: "عنوان المركز",
  center_logo_path: "مسار شعار المركز",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({
    center_name: "",
    center_phone: "",
    center_address: "",
    center_logo_path: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: Setting[]) => {
        const map: Record<string, string> = {};
        for (const s of data) map[s.key] = s.value;
        setSettings((prev) => ({ ...prev, ...map }));
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="max-w-lg">
      <PageHeader title="إعدادات النظام" description="بيانات المركز المستخدمة في التقارير والفواتير" />

      <form onSubmit={handleSave} className="card p-6 space-y-4">
        {Object.entries(KEYS).map(([key, label]) => (
          <div key={key}>
            <label className="label">{label}</label>
            <input
              value={settings[key] ?? ""}
              onChange={(e) => setSettings((prev) => ({ ...prev, [key]: e.target.value }))}
              className="input"
              dir={key === "center_phone" ? "ltr" : undefined}
            />
          </div>
        ))}
        <div className="flex items-center gap-4 pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
          </button>
          {saved && <span className="text-sm text-green-600">تم الحفظ ✓</span>}
        </div>
      </form>
    </div>
  );
}
