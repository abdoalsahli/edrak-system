"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const chip = (on: boolean) =>
  cn(
    "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
    on ? "border-primary-600 bg-primary-50 text-primary-700" : "border-gray-300 bg-white text-gray-600 hover:border-primary-300",
  );

/**
 * One choice from a list (keys → labels), or «أخرى» with free text — like the
 * single-choice questions of the centre's forms. The value is a key or the text.
 */
export function ChoiceRadio({
  options, value, onChange, name,
}: {
  options: Record<string, string>;
  value: string;
  onChange: (v: string) => void;
  name: string;
}) {
  const isOther = value !== "" && !(value in options);
  const [otherOn, setOtherOn] = useState(isOther);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {Object.entries(options).map(([key, label]) => (
        <label key={key} className={chip(value === key)}>
          <input
            type="radio" name={name} className="sr-only" checked={value === key}
            onChange={() => { setOtherOn(false); onChange(key); }}
          />
          {label}
        </label>
      ))}
      <label className={chip(otherOn)}>
        <input type="radio" name={name} className="sr-only" checked={otherOn} onChange={() => { setOtherOn(true); onChange(isOther ? value : ""); }} />
        أخرى
      </label>
      {otherOn && (
        <input value={isOther ? value : ""} onChange={(e) => onChange(e.target.value)} className="input h-9 max-w-xs" placeholder="اكتب…" autoFocus />
      )}
    </div>
  );
}

/**
 * Several choices from a list, plus «أخرى» entries in free text — like the
 * checkbox questions of the forms. The value lists the chosen labels and texts.
 */
export function ChoiceChecks({
  options, value, onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const others = value.filter((v) => !options.includes(v));
  const [otherText, setOtherText] = useState(others.join("، "));
  const [otherOn, setOtherOn] = useState(others.length > 0);

  const setOthers = (text: string) => {
    setOtherText(text);
    const extra = text.split(/[،,]/).map((t) => t.trim()).filter(Boolean);
    onChange([...value.filter((v) => options.includes(v)), ...extra]);
  };
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((o) => (
        <label key={o} className={chip(value.includes(o))}>
          <input type="checkbox" className="sr-only" checked={value.includes(o)} onChange={() => toggle(o)} />
          {o}
        </label>
      ))}
      <label className={chip(otherOn)}>
        <input
          type="checkbox" className="sr-only" checked={otherOn}
          onChange={() => { if (otherOn) setOthers(""); setOtherOn(!otherOn); }}
        />
        أخرى
      </label>
      {otherOn && (
        <input value={otherText} onChange={(e) => setOthers(e.target.value)} className="input h-9 max-w-sm" placeholder="اكتب، وافصل بفاصلة" autoFocus />
      )}
    </div>
  );
}

/** A labelled field block of a form. */
export function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

/** A read-only answer in a plan or report view (keeps line breaks). */
export function Answer({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="break-inside-avoid">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <div className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-800">{children || "—"}</div>
    </div>
  );
}
