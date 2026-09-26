// MonthView.tsx — admin month overview of all appointments in a calendar grid
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Occurrence } from "../api/types";
import { Icon } from "../components/icons";

function getMonthBounds(year: number, month: number): { start: string; end: string } {
  const end = new Date(year, month + 1, 0);
  return {
    start: `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00`,
    end: end.toISOString().slice(0, 10) + "T23:59:59",
  };
}

function isoDate(iso: string): string {
  return iso.slice(0, 10);
}

// Hoisted cell helper
function DayCell({ dayNum, appts, today }: { dayNum: number; appts: Occurrence[]; today: boolean }) {
  return (
    <div className={`well rounded-[14px] p-2 min-h-[96px] flex flex-col gap-1 ${today ? "ring-4 ring-brand" : ""}`}>
      <span className="text-base font-bold font-display">{dayNum}</span>
      {appts.map(a => (
        <div key={`${a.appointment_id}-${a.start}`}
             className="btn-primary text-[1rem] leading-snug rounded-lg px-2 py-1 truncate shadow-none">
          {a.title}
        </div>
      ))}
    </div>
  );
}

export function MonthView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [appts, setAppts] = useState<Occurrence[]>([]);

  function load(y: number, m: number): void {
    const { start, end } = getMonthBounds(y, m);
    api.get<Occurrence[]>(`/api/appointments?start=${start}&end=${end}`)
      .then(setAppts).catch(console.error);
  }

  useEffect(() => { load(year, month); }, [year, month]);

  function prev(): void {
    const d = new Date(year, month - 1, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth());
  }
  function next(): void {
    const d = new Date(year, month + 1, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth());
  }

  const monthName = new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Build grid cells: leading blanks + numbered days
  const cells: Array<{ dayNum: number | null; iso: string; appts: Occurrence[] }> = [];
  for (let i = 0; i < firstDay; i++) cells.push({ dayNum: null, iso: "", appts: [] });
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ dayNum: d, iso, appts: appts.filter(a => isoDate(a.start) === iso) });
  }

  return (
    <section className="glass rounded-card p-5 sm:p-6 flex flex-col gap-4 mt-6">
      <div className="flex items-center gap-4">
        <button type="button" onClick={prev} aria-label="Previous month"
                className="chrome pressable rounded-pill w-16 h-16 inline-flex items-center justify-center">
          <Icon name="back" size={30} />
        </button>
        <h2 className="font-display text-title font-bold flex-1 text-center m-0">{monthName}</h2>
        <button type="button" onClick={next} aria-label="Next month"
                className="chrome pressable rounded-pill w-16 h-16 inline-flex items-center justify-center">
          <Icon name="arrow" size={30} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-base font-bold text-center text-ink-soft">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) =>
          c.dayNum === null
            ? <div key={`blank-${i}`} className="min-h-[96px]" />
            : <DayCell key={c.dayNum} dayNum={c.dayNum} appts={c.appts} today={c.iso === todayIso} />
        )}
      </div>
    </section>
  );
}
