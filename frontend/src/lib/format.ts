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
