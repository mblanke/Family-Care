import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../lib/auth";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Confirmation } from "../components/Confirmation";
import { ErrorBanner } from "../components/ErrorBanner";
import { ScreenTitle } from "../components/ScreenTitle";
import { Icon, type IconName } from "../components/icons";

interface Contact {
  id: number;
  name: string;
  role: string;
  phone: string;
  address: string | null;
  notes: string | null;
  person_id: number | null;
  is_emergency: boolean;
}

const ROLE: Record<string, { icon: IconName; label: string }> = {
  doctor: { icon: "heart", label: "Doctor" },
  paramedics: { icon: "car", label: "Paramedics" },
  occupational_therapist: { icon: "people", label: "Occupational therapist" },
  pharmacist: { icon: "pill", label: "Pharmacist" },
  other: { icon: "person", label: "Other" },
};

const EMPTY = { name: "", role: "doctor", phone: "", is_emergency: false, address: "" };

function ContactCard({ c, canEdit, onDelete }: { c: Contact; canEdit: boolean; onDelete: (c: Contact) => void }) {
  const r = ROLE[c.role] ?? ROLE.other;
  return (
    <div className="well rounded-[22px] p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-big font-bold flex-1">{c.name}</span>
        <span className="chrome rounded-[14px] px-3 py-1 text-base font-bold inline-flex items-center gap-2">
          <Icon name={r.icon} size={22} />{r.label}
        </span>
      </div>
      {c.notes && <p className="m-0 text-base text-ink-soft">{c.notes}</p>}
      <a
        href={`tel:${c.phone}`}
        aria-label={`Call ${c.name}`}
        className="btn-confirm pressable min-h-[72px] rounded-pill text-big font-bold
                   inline-flex items-center justify-center gap-3 w-full no-underline"
      >
        <Icon name="phone" size={30} />Call {c.name}
      </a>
      {c.address && (
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(c.address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-base underline inline-flex items-center gap-2 min-h-[44px]"
        >
          <Icon name="pin" size={24} />{c.address}
        </a>
      )}
      {canEdit && (
        <div>
          <Button variant="secondary" size="base" onClick={() => onDelete(c)} icon={<Icon name="trash" size={24} />}>Remove</Button>
        </div>
      )}
    </div>
  );
}

export function Contacts() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "family";
  const [list, setList] = useState<Contact[]>([]);
  const [toDelete, setToDelete] = useState<Contact | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [ack, setAck] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    api.get<Contact[]>("/api/contacts").then(setList)
      .catch(() => setError("Couldn't load the contacts. Please try again."));
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.name.trim() || !form.phone.trim()) {
      setFormError("Enter a name and a phone number.");
      return;
    }
    try {
      await api.post("/api/contacts", { ...form, name: form.name.trim(), phone: form.phone.trim(), address: form.address || null });
      setForm(EMPTY);
      setFormError(null);
      setAck("Contact added");
      load();
    } catch {
      setError("Couldn't add the contact. Please try again.");
    }
  }

  async function remove(c: Contact) {
    setToDelete(null);
    try {
      await api.delete(`/api/contacts/${c.id}`);
      setAck("Contact removed");
      load();
    } catch {
      setError("Couldn't remove the contact. Please try again.");
    }
  }

  const emergency = list.filter(c => c.is_emergency);
  const rest = list.filter(c => !c.is_emergency);
  const fieldCls = "field rounded-[20px] px-5 text-big";

  return (
    <div className="flex flex-col gap-6">
      {ack && <Confirmation message={ack} onDone={() => setAck(null)} />}
      {error && <ErrorBanner message={error} onDone={() => setError(null)} />}
      <ScreenTitle>Contacts</ScreenTitle>

      {emergency.length > 0 && (
        <Card title="Emergency" icon="alert" className="border-2 border-danger/40">
          {emergency.map(c => <ContactCard key={c.id} c={c} canEdit={canEdit} onDelete={setToDelete} />)}
        </Card>
      )}

      {rest.length > 0 && (
        <Card>
          {rest.map(c => <ContactCard key={c.id} c={c} canEdit={canEdit} onDelete={setToDelete} />)}
        </Card>
      )}

      {list.length === 0 && (
        <Card><p className="m-0 text-big text-ink-soft">No contacts yet.</p></Card>
      )}

      {canEdit && (
        <Card title="Add a contact" icon="person">
          {formError && (
            <p role="alert" className="m-0 text-big font-bold text-danger flex items-center gap-3">
              <Icon name="alert" size={30} />{formError}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-base font-bold">Name
              <input className={fieldCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
            <label className="flex flex-col gap-1 text-base font-bold">Phone
              <input className={fieldCls} type="tel" inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="flex flex-col gap-1 text-base font-bold"><span>Address <span className="font-normal text-ink-soft">(optional)</span></span>
              <input className={fieldCls} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></label>
            <label className="flex flex-col gap-1 text-base font-bold">Who they are
              <select className={fieldCls} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                {Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select></label>
          </div>
          <label className="text-base font-bold flex items-center gap-3 min-h-touch">
            <input type="checkbox" className="w-8 h-8 accent-brand" checked={form.is_emergency}
                   onChange={e => setForm({ ...form, is_emergency: e.target.checked })} />
            Show at the top as an emergency number
          </label>
          <div>
            <Button onClick={add} icon={<Icon name="plus" strokeWidth={2.8} />} aria-label="Add contact">Add contact</Button>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Remove this contact?"
        body={toDelete?.name}
        confirmLabel="Remove"
        cancelLabel="Keep"
        onConfirm={() => toDelete && remove(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
