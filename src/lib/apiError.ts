/**
 * Extract a human-readable message from a failed API response.
 *
 * The API returns errors in a few shapes:
 *   { error: "text" }                                  — unauthorized / forbidden / not found
 *   { error: { message: "text" } }                     — badRequest({ message })
 *   { error: { formErrors: [], fieldErrors: {...} } }  — badRequest(zodError.flatten())
 *   { message: "text" }                                — a few routes respond directly
 *
 * Reads the body once, so do not call res.json() before this.
 */
export async function readApiError(res: Response, fallback = "حدث خطأ"): Promise<string> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return statusFallback(res.status, fallback);
  }

  const msg = pickMessage(body);
  return msg ?? statusFallback(res.status, fallback);
}

function pickMessage(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value !== "object") return null;

  const obj = value as Record<string, unknown>;

  if (typeof obj.message === "string") return obj.message;
  if (obj.error !== undefined) {
    const inner = pickMessage(obj.error);
    if (inner) return inner;
  }

  // Zod flatten(): { formErrors: string[], fieldErrors: { field: string[] } }
  if (Array.isArray(obj.formErrors) && typeof obj.formErrors[0] === "string") {
    return obj.formErrors[0];
  }
  if (obj.fieldErrors && typeof obj.fieldErrors === "object") {
    for (const errs of Object.values(obj.fieldErrors as Record<string, unknown>)) {
      if (Array.isArray(errs) && typeof errs[0] === "string") return errs[0];
    }
  }

  // A bare { field: [messages] } object
  for (const v of Object.values(obj)) {
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  }
  return null;
}

function statusFallback(status: number, fallback: string): string {
  if (status === 401) return "انتهت الجلسة — سجّل الدخول مرة أخرى";
  if (status === 403) return "ليست لديك صلاحية لهذا الإجراء";
  if (status === 404) return "العنصر غير موجود";
  return fallback;
}
