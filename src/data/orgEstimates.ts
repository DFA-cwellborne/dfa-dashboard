// Organizational estimates that aren't derived from any synced data source —
// figures the org has given directly, not computed. Keep these in one place,
// clearly separate from the compute.ts functions that derive real numbers
// from Supabase, so nothing here is ever confused with a live metric.
// Update the values (and this note) when the org has a new estimate.
export const ORG_ESTIMATES = {
  /** Typical attendance at an ordinary (non-flagship) chapter meeting. */
  typicalMeetingAttendance: "10–12",
  /** Days from a "start a chapter" interest-form submission to charter. */
  interestToCharterDays: 14,
  /** Days from charter to a chapter's first logged event. */
  charterToFirstEventDays: 10,
} as const;
