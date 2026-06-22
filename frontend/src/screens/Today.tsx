import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { TodayData } from "../api/types";
import { formatTime } from "../lib/format";

export function Today() {
  const [data, setData] = useState<TodayData | null>(null);
  useEffect(() => { void api.get<TodayData>("/api/today").then(setData); }, []);
  if (!data) return <p className="p-6 text-big">Loading today…</p>;
  return (
    <div className="p-6 flex flex-col gap-8">
      <section>
        <h2 className="text-huge font-bold mb-3">Today</h2>
        {data.appointments.length === 0 && <p className="text-big">Nothing scheduled today.</p>}
        {data.appointments.map(a => (
          <div key={`${a.appointment_id}-${a.start}`}
               className="border-4 rounded-2xl p-4 mb-3 flex items-center gap-4">
            <span className="text-big font-bold w-28">{formatTime(a.start)}</span>
            <span className="text-big flex-1">{a.title}{a.location ? ` · ${a.location}` : ""}</span>
            {a.needs_ride && (
              <span className="text-base font-bold bg-brand text-paper rounded-xl px-3 py-1
                               inline-flex items-center gap-2">🚗 Needs a ride</span>
            )}
          </div>
        ))}
      </section>
      {data.upcoming_birthdays.length > 0 && (
        <section>
          <h2 className="text-big font-bold mb-2">Coming up</h2>
          {data.upcoming_birthdays.map(b => (
            <p key={b.birthday_id} className="text-big">🎂 {b.name}&apos;s birthday
              {b.days_until === 0 ? " is today!" : ` in ${b.days_until} day${b.days_until === 1 ? "" : "s"}`}
              {b.turning ? ` (turning ${b.turning})` : ""}</p>
          ))}
        </section>
      )}
    </div>
  );
}
