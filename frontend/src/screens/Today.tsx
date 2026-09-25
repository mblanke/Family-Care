// Today.tsx — appointments, open to-dos and upcoming birthdays for today
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { TodayData, PersonApi, Occurrence } from "../api/types";
import { formatTime, formatDay, formatDaysUntil } from "../lib/format";
import { Card, Well } from "../components/Card";
import { ScreenTitle } from "../components/ScreenTitle";
import { PersonBadge } from "../components/PersonBadge";
import { Button } from "../components/Button";
import { Icon } from "../components/icons";

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RideBadge() {
  return (
    <span className="btn-primary rounded-pill px-4 py-2 text-base font-bold inline-flex items-center gap-2 shrink-0">
      <Icon name="car" size={26} />Needs a ride
    </span>
  );
}

export function AppointmentRow({ a, people }: { a: Occurrence; people: PersonApi[] }) {
  const who = a.for_both ? people : people.filter(p => p.id === a.person_id);
  return (
    <Well className="flex-wrap">
      <div className="chrome rounded-[18px] min-w-[8.25rem] min-h-touch flex items-center justify-center font-display text-big font-bold px-3">
        {formatTime(a.start)}
      </div>
      <div className="flex-1 min-w-[12rem] flex flex-col">
        <div className="text-big font-bold">{a.title}</div>
        {a.location && <div className="text-base text-ink-soft">{a.location}</div>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {who.map(p => <PersonBadge key={p.id} person={p} />)}
        {a.needs_ride && <RideBadge />}
      </div>
    </Well>
  );
}

export function Today() {
  const [data, setData] = useState<TodayData | null>(null);
  const [people, setPeople] = useState<PersonApi[]>([]);
  const [failed, setFailed] = useState(false);

  function load() {
    setFailed(false);
    api.get<TodayData>("/api/today").then(setData).catch(() => setFailed(true));
    api.get<PersonApi[]>("/api/people").then(setPeople).catch(() => { /* badges are optional */ });
  }
  useEffect(() => { load(); }, []);

  if (failed) {
    return (
      <Card>
        <p role="alert" className="m-0 text-big font-bold flex items-center gap-3">
          <Icon name="alert" size={32} />Couldn't load today's plan.
        </p>
        <div><Button variant="secondary" onClick={load}>Try again</Button></div>
      </Card>
    );
  }
  if (!data) return <p className="text-big text-ink-soft px-1">Loading today…</p>;

  return (
    <div className="flex flex-col gap-6">
      <ScreenTitle sub={formatDay(localToday())}>Today</ScreenTitle>

      <Card title="Appointments" icon="calendar">
        {data.appointments.length === 0 && <p className="m-0 text-big">Nothing scheduled today.</p>}
        {data.appointments.map(a => <AppointmentRow key={`${a.appointment_id}-${a.start}`} a={a} people={people} />)}
      </Card>

      {data.open_todos.length > 0 && (
        <Card title="To do" icon="list">
          <ul className="m-0 p-0 list-none flex flex-col gap-2">
            {data.open_todos.map(t => (
              <li key={t.id} className="text-big flex items-center gap-4 px-1">
                <span aria-hidden="true" className="chrome w-8 h-8 rounded-lg shrink-0" />
                {t.text}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.upcoming_birthdays.length > 0 && (
        <Card title="Coming up" icon="cake">
          {data.upcoming_birthdays.map(b => (
            <p key={b.birthday_id} className="m-0 text-big flex items-center gap-4">
              <Icon name="cake" size={34} className="text-brand shrink-0" />
              <span>
                <strong>{b.name}&apos;s birthday</strong> {b.days_until === 0 ? "is today!" : formatDaysUntil(b.days_until)}
                {b.turning ? ` (turning ${b.turning})` : ""}
              </span>
            </p>
          ))}
        </Card>
      )}
    </div>
  );
}
