"use client";

import { LoginCard } from "@/components/staff/LoginCard";

/**
 * حساب الدخول — gives the therapist a login for «جدولي»: their own schedule and
 * session outcomes, nothing else. Managers only.
 */
export function TherapistLoginCard({ therapistId }: { therapistId: string }) {
  return (
    <LoginCard
      url={`/api/therapists/${therapistId}/login`}
      description="يدخل به الأخصائي إلى «جدولي»: يرى جلساته فقط ويسجّل نتيجتها. لا يرى المبالغ ولا بقية أقسام النظام."
    />
  );
}
