/** Used whenever a service has no duration / price of its own. */
export const DEFAULT_SESSION_MINUTES = 60;
export const DEFAULT_SESSION_PRICE = 50; // د.ل

type ServiceDefaults = { defaultDurationMin?: number | null; defaultPrice?: number | string | null };

/** The service's own duration and price per session, falling back to 60 min / 50 د.ل. */
export function sessionDefaults(svc: ServiceDefaults | null | undefined) {
  const minutes = svc?.defaultDurationMin && svc.defaultDurationMin > 0 ? svc.defaultDurationMin : DEFAULT_SESSION_MINUTES;
  const price = svc?.defaultPrice != null && Number(svc.defaultPrice) > 0 ? Number(svc.defaultPrice) : DEFAULT_SESSION_PRICE;
  return { minutes, price };
}
