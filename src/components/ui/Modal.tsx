"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

// Modals can stack (e.g. «حالة جديدة» over «جلسة جديدة»): unlock scrolling only when the last one closes
let openCount = 0;

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  // Esc closes the top-most modal
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    openCount++;
    document.body.style.overflow = "hidden";
    return () => {
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const sizeMap = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  // Rendered at <body> so a modal opened from inside another form never nests <form>s
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-gray-800/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative w-full rounded-t-card bg-white shadow-xl sm:rounded-card",
          sizeMap[size]
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-6 sm:py-5">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="max-h-[calc(100dvh-6rem)] overflow-y-auto p-4 sm:max-h-[calc(100vh-8rem)] sm:p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}
