// Schedule.tsx — week agenda + driver roll-up card
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { WeekData, PersonApi } from "../api/types";
import { formatTime, formatDay } from "../lib/format";
import { AppointmentForm } from "../admin/AppointmentForm";
import { Button } from "../components/Button";

// Hoisted helper — NOT defined inside Schedule render
function DaySection({ day }: { day: WeekData["days"][0] }) {
  return (
    <section className="mb-6">
      <h3 className="text-big font-bold mb-2">{formatDay(day.date)}</h3>
      {day.appointments.length === 0 && (
        <p className="text-base text-gray-500 pl-2">Nothing scheduled</p>
      )}
      {day.appointments.map(a => (
        <div key={`${a.appointment_id}-${a.start}`}
             className="border-4 rounded-2xl p-4 mb-3 flex items-center gap-4">
          <span className="text-big font-bold w-28 shrink-0">{formatTime(a.start)}</span>
          <span className="text-big flex-1">{a.title}{a.location ? ` · ${a.location}` : ""}</span>
          {a.needs_ride && (
            <span className="bg-brand text-paper rounded-xl px-3 py-1 text-base font-bold">🚗 Ride</span>
          )}
        </div>
      ))}
    </section>
  );
}

export function Schedule({ canEdit }: { canEdit: boolean }) {
  const [week, setWeek] = useState<WeekData | null>(null);
  const [people, setPeople] = useState<PersonApi[]>([]);
  const [showForm, setShowForm] = useState(false);

  function load(): void {
    api.get<WeekData>("/api/week").then(setWeek).catch(console.error);
  }
  useEffect(() => {
    load();
    api.get<PersonApi[]>("/api/people").then(setPeople).catch(console.error);
  }, []);

  if (!week) return <p className="p-6 text-big">Loading schedule…</p>;

  return (
    <div className="p-6 flex flex-col gap-6">
      <h2 className="text-huge font-bold">This Week</h2>

      {/* Driver roll-up card */}
      <div className="border-4 border-brand rounded-2xl p-4 bg-paper">
        <h3 className="text-big font-bold mb-3">🚗 What I'm driving this week</h3>
        {week.driver_runs.length === 0 ? (
          <p className="text-big">No rides needed this week.</p>
        ) : (
          week.driver_runs.map(r => (
            <div key={`${r.appointment_id}-${r.start}`}
                 className="flex items-center gap-3 mb-2">
              <span className="text-base font-bold w-24 shrink-0">{formatTime(r.start)}</span>
              <span className="text-big">
            <span>{r.title}</span>
            {r.location && <span> · {r.location}</span>}
          </span>
            </div>
          ))
        )}
      </div>

      {/* Day sections — vertical list */}
      {week.days.map(day => (
        <DaySection key={day.date} day={day} />
      ))}

      {canEdit && (
        <Button onClick={() => setShowForm(s => !s)}>
          {showForm ? "Cancel" : "Add Appointment"}
        </Button>
      )}
      {canEdit && showForm && (
        <AppointmentForm
          people={people}
          onSaved={() => { setShowForm(false); load(); }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
