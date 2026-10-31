/**
 * The centre's week starts on Saturday. Day numbers stay JavaScript's
 * (0 = Sunday … 6 = Saturday); only the order they are shown in changes.
 */
export const WEEK_STARTS_ON = 6 as const;

/** Weekdays in display order: السبت، الأحد … الجمعة */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];

/** Position of a day in the week: Saturday → 0, Friday → 6. */
export const weekIndex = (day: number) => (day - WEEK_STARTS_ON + 7) % 7;
