/** Today as YYYY-MM-DD in the viewer's own timezone (what "today" means to them). */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parses a date-only "YYYY-MM-DD" string (e.g. last_event_date) as that
 * calendar day in the viewer's own timezone. `new Date("YYYY-MM-DD")`
 * parses as UTC midnight, so formatting it with date-fns `format()` can
 * show the previous day for anyone west of UTC — this constructs the Date
 * from its parts instead, which can't shift.
 */
export function parseDateOnly(dateOnly: string): Date {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(y, m - 1, d);
}
