import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Person } from "../lib/people";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Confirmation } from "../components/Confirmation";
import { ErrorBanner } from "../components/ErrorBanner";
import { ScreenTitle } from "../components/ScreenTitle";
import { Icon } from "../components/icons";

interface Acct {
  id: number;
  username: string;
  display_name: string;
  role: string;
  person_id: number | null;
  is_active: boolean;
}

const ROLE_LABEL: Record<string, string> = { admin: "Admin", family: "Family", parent: "Parent" };
const EMPTY = { username: "", password: "", display_name: "", role: "family", person_id: "" };

export function Accounts() {
  const [accts, setAccts] = useState<Acct[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [ack, setAck] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setAccts(await api.get<Acct[]>("/api/accounts").catch(() => []));
    setPeople(await api.get<Person[]>("/api/people").catch(() => []));
  }

  useEffect(() => { void load(); }, []);

  async function create() {
    if (!form.username.trim() || !form.password || !form.display_name.trim()) {
      setFormError("Enter a username, a display name and a password.");
      return;
    }
    if (form.role === "parent" && !form.person_id) {
      setFormError("Choose which parent this account is for.");
      return;
    }
    setFormError(null);
    try {
      await api.post("/api/accounts", {
        ...form,
        username: form.username.trim(),
        display_name: form.display_name.trim(),
        person_id: form.role === "parent" && form.person_id ? Number(form.person_id) : null,
      });
      setForm(EMPTY);
      setAck("Account created");
      await load();
    } catch {
      setError("Couldn't create the account. Please try again.");
    }
  }

  const fieldCls = "field rounded-[20px] px-5 text-big";

  return (
    <div className="flex flex-col gap-6">
      {ack && <Confirmation message={ack} onDone={() => setAck(null)} />}
      {error && <ErrorBanner message={error} onDone={() => setError(null)} />}
      <ScreenTitle>Accounts</ScreenTitle>

      <Card title="Create an account" icon="key">
        {formError && (
          <p role="alert" className="m-0 text-big font-bold text-danger flex items-center gap-3">
            <Icon name="alert" size={30} />{formError}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-base font-bold">Username
            <input className={fieldCls} autoCapitalize="none" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-base font-bold">Display name
            <input className={fieldCls} value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-base font-bold">Password
            <input type="password" autoComplete="new-password" className={fieldCls} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-base font-bold">Role
            <select className={fieldCls} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="family">Family: adds and edits</option>
              <option value="parent">Parent: simple Today-first view</option>
              <option value="admin">Admin: everything</option>
            </select></label>
          {form.role === "parent" && (
            <label className="flex flex-col gap-1 text-base font-bold">Which parent is this account for?
              <select className={fieldCls} value={form.person_id} onChange={e => setForm({ ...form, person_id: e.target.value })}>
                <option value="">Choose…</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></label>
          )}
        </div>
        <div>
          <Button onClick={create} icon={<Icon name="plus" strokeWidth={2.8} />}>Create account</Button>
        </div>
      </Card>

      <Card title="Existing accounts" icon="people">
        {accts.length === 0 ? (
          <p className="m-0 text-base text-ink-soft">No accounts yet.</p>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col gap-2">
            {accts.map(a => (
              <li key={a.id} className="well rounded-[18px] px-4 py-3 text-big flex items-center gap-3 flex-wrap">
                <span className="font-bold flex-1">{a.display_name}</span>
                <span className="text-base text-ink-soft">{a.username}</span>
                <span className="chrome rounded-[12px] px-3 py-1 text-base font-bold">{ROLE_LABEL[a.role] ?? a.role}</span>
                {!a.is_active && <span className="text-base text-ink-soft">inactive</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
