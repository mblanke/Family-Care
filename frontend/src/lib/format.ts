// lib/format.ts — server sends naive-local ISO; render without re-zoning
export function formatTime(iso: string): string {
  const [, hms] = iso.split("T");
  const [h, m] = hms.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
export function formatDay(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}
/** "June 1, 2026" — for history entries and readings. Accepts a date or a date-time. */
export function formatDate(iso: string): string {
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}
/** "September 24, 8:10 am" — a reading's timestamp without the year. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  return `${day}, ${formatTime(iso)}`;
}
/** "tomorrow", "in 3 days", "today" — for the Coming up list. */
export function formatDaysUntil(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}
