import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Todo } from "../api/types";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CheckSquare } from "../components/CheckSquare";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Confirmation } from "../components/Confirmation";
import { ErrorBanner } from "../components/ErrorBanner";
import { ScreenTitle } from "../components/ScreenTitle";
import { Icon } from "../components/icons";

// Hoisted to module scope — not inside render — to avoid remount/focus churn
function Row({ t, onToggle, onDelete }:
  { t: Todo; onToggle: (t: Todo) => void; onDelete: (t: Todo) => void }) {
  return (
    <li className="flex items-center gap-4 px-1 py-1">
      <CheckSquare done={t.done} itemName={t.text} onToggle={() => onToggle(t)} />
      <span className={`flex-1 text-big ${t.done ? "line-through text-ink-soft" : ""}`}>{t.text}</span>
      <button type="button" onClick={() => onDelete(t)} aria-label={`Delete ${t.text}`}
              className="chrome pressable rounded-[18px] w-16 h-16 inline-flex items-center justify-center shrink-0">
        <Icon name="trash" size={26} />
      </button>
    </li>
  );
}

export function TodoScreen() {
  const [items, setItems] = useState<Todo[]>([]);
  const [text, setText] = useState("");
  const [ack, setAck] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Todo | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<Todo[]>("/api/todos")
      .then(setItems)
      .catch(() => setError("Couldn't load the list. Please try again."));
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!text.trim()) return;
    try {
      await api.post("/api/todos", { text: text.trim() });
      setText("");
      setAck("Added to the list");
      load();
    } catch {
      setError("Couldn't add the item. Please try again.");
    }
  }

  async function toggle(t: Todo) {
    try {
      await api.post(`/api/todos/${t.id}/done`, { done: !t.done });
      if (!t.done) setAck("Checked off");
      load();
    } catch {
      setError("Couldn't save. Please try again.");
    }
  }

  async function remove(t: Todo) {
    setToDelete(null);
    try {
      await api.delete(`/api/todos/${t.id}`);
      setAck("Removed");
      load();
    } catch {
      setError("Couldn't remove the item. Please try again.");
    }
  }

  const open = items.filter(i => !i.done);
  const done = items.filter(i => i.done);

  return (
    <div className="flex flex-col gap-6">
      {ack && <Confirmation message={ack} onDone={() => setAck(null)} />}
      {error && <ErrorBanner message={error} onDone={() => setError(null)} />}
      <ScreenTitle>To-do</ScreenTitle>

      <Card as="div" className="!flex-row items-center flex-wrap">
        <label htmlFor="new-todo" className="sr-only-label">New to-do item</label>
        <input
          id="new-todo"
          className="field rounded-[20px] px-5 text-big flex-1 min-w-[14rem]"
          placeholder="Add an item"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
        />
        <Button onClick={add} icon={<Icon name="plus" strokeWidth={2.8} />}>Add</Button>
      </Card>

      <Card>
        {open.length === 0 ? (
          <p className="m-0 text-big text-ink-soft">Nothing on the list. Add something above.</p>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col gap-2">
            {open.map(t => <Row key={t.id} t={t} onToggle={toggle} onDelete={setToDelete} />)}
          </ul>
        )}
      </Card>

      {done.length > 0 && (
        <Card title="Done" icon="check">
          <ul className="m-0 p-0 list-none flex flex-col gap-2 opacity-80">
            {done.map(t => <Row key={t.id} t={t} onToggle={toggle} onDelete={setToDelete} />)}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Remove this item?"
        body={toDelete?.text}
        confirmLabel="Remove"
        cancelLabel="Keep"
        onConfirm={() => toDelete && remove(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
