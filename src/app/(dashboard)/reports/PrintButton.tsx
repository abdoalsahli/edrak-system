"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary text-sm">
      <Printer className="size-4" />طباعة
    </button>
  );
}
