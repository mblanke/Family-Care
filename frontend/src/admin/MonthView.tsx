// MonthView.tsx — admin month overview of all appointments in a calendar grid
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Occurrence } from "../api/types";

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
function DayCell({ dayNum, appts }: { dayNum: number; appts: Occurrence[] }) {
  return (
    <div className="border rounded-lg p-2 min-h-[80px] flex flex-col gap-1">
      <span className="text-base font-bold">{dayNum}</span>
      {appts.map(a => (
        <div key={`${a.appointment_id}-${a.start}`}
             className="text-sm bg-brand text-paper rounded px-1 truncate">
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

  // Build grid cells: leading blanks + numbered days
  const cells: Array<{ dayNum: number | null; appts: Occurrence[] }> = [];
  for (let i = 0; i < firstDay; i++) cells.push({ dayNum: null, appts: [] });
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ dayNum: d, appts: appts.filter(a => isoDate(a.start) === iso) });
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <button onClick={prev} className="min-h-touch px-5 border-4 rounded-2xl text-big">‹</button>
        <h2 className="text-huge font-bold flex-1 text-center">{monthName}</h2>
        <button onClick={next} className="min-h-touch px-5 border-4 rounded-2xl text-big">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-base font-bold text-center mb-1">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) =>
          c.dayNum === null
            ? <div key={`blank-${i}`} className="min-h-[80px]" />
            : <DayCell key={c.dayNum} dayNum={c.dayNum} appts={c.appts} />
        )}
      </div>
    </div>
  );
}
