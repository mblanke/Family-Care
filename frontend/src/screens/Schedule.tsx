// Schedule.tsx — week agenda + driver roll-up card
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { WeekData, PersonApi } from "../api/types";
import { formatTime, formatDay } from "../lib/format";
import { AppointmentForm } from "../admin/AppointmentForm";
import { Button } from "../components/Button";
import { Card, Well } from "../components/Card";
import { ErrorBanner } from "../components/ErrorBanner";
import { ScreenTitle } from "../components/ScreenTitle";
import { RideBadge } from "./Today";
import { Icon } from "../components/icons";

// Hoisted helper — NOT defined inside Schedule render
function DaySection({ day }: { day: WeekData["days"][0] }) {
  return (
    <Card title={formatDay(day.date)}>
      {day.appointments.length === 0 && (
        <p className="m-0 text-base text-ink-soft">Nothing scheduled</p>
      )}
      {day.appointments.map(a => (
        <Well key={`${a.appointment_id}-${a.start}`} className="flex-wrap">
          <span className="chrome rounded-[18px] min-w-[8.25rem] min-h-touch inline-flex items-center justify-center font-display text-big font-bold px-3">
            {formatTime(a.start)}
          </span>
          <span className="text-big flex-1 min-w-[12rem]">{a.title}{a.location ? ` · ${a.location}` : ""}</span>
          {a.needs_ride && <RideBadge />}
        </Well>
      ))}
    </Card>
  );
}

export function Schedule({ canEdit }: { canEdit: boolean }) {
  const [week, setWeek] = useState<WeekData | null>(null);
  const [people, setPeople] = useState<PersonApi[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load(): void {
    api.get<WeekData>("/api/week").then(setWeek)
      .catch(() => setError("Couldn't load the schedule. Please try again."));
  }
  useEffect(() => {
    load();
    api.get<PersonApi[]>("/api/people").then(setPeople).catch(() => { /* chips are optional */ });
  }, []);

  if (!week) {
    return (
      <>
        {error && <ErrorBanner message={error} onDone={() => setError(null)} />}
        <p className="text-big text-ink-soft px-1">Loading schedule…</p>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <ErrorBanner message={error} onDone={() => setError(null)} />}
      <ScreenTitle>This week</ScreenTitle>

      {/* Driver roll-up card */}
      <Card title="Rides someone is driving this week" icon="car" className="border-2 border-brand/50">
        {week.driver_runs.length === 0 ? (
          <p className="m-0 text-big">No rides needed this week.</p>
        ) : (
          week.driver_runs.map(r => (
            <div key={`${r.appointment_id}-${r.start}`} className="flex items-center gap-4 flex-wrap">
              <span className="chrome rounded-[14px] min-w-[7rem] min-h-[52px] inline-flex items-center justify-center font-display text-base font-bold px-3">
                {formatTime(r.start)}
              </span>
              <span className="text-base text-ink-soft min-w-[9rem]">{formatDay(r.start.slice(0, 10))}</span>
              <span className="text-big">
                <span>{r.title}</span>
                {r.location && <span className="text-ink-soft"> · {r.location}</span>}
              </span>
            </div>
          ))
        )}
      </Card>

      {/* Day sections — vertical list */}
      {week.days.map(day => (
        <DaySection key={day.date} day={day} />
      ))}

      {canEdit && !showForm && (
        <div>
          <Button onClick={() => setShowForm(true)} icon={<Icon name="plus" strokeWidth={2.8} />}>Add appointment</Button>
        </div>
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
