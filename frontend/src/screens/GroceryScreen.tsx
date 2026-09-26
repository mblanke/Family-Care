import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { GroceryItem } from "../api/types";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CheckSquare } from "../components/CheckSquare";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Confirmation } from "../components/Confirmation";
import { ErrorBanner } from "../components/ErrorBanner";
import { ScreenTitle } from "../components/ScreenTitle";
import { SegmentedControl } from "../components/SegmentedControl";
import { Stepper } from "../components/Stepper";
import { Icon } from "../components/icons";

type Filter = "costco" | "grocery" | "all";
type Store = GroceryItem["store"];
const STORE_LABEL: Record<Store, string> = {
  costco: "Costco",
  grocery: "Grocery store",
  either: "Either store",
};
const FILTERS = [
  { id: "costco" as const, label: "Costco" },
  { id: "grocery" as const, label: "Grocery store" },
  { id: "all" as const, label: "All" },
];

// Hoisted to module scope — not inside render — to avoid remount/focus churn
function ItemRow({ i, onCheck, onStep }:
  { i: GroceryItem; onCheck: (i: GroceryItem) => void; onStep: (i: GroceryItem, d: number) => void }) {
  return (
    <li className={`flex items-center gap-4 px-1 py-1 flex-wrap ${i.checked ? "opacity-60" : ""}`}>
      <CheckSquare done={i.checked} itemName={i.name} onToggle={() => onCheck(i)} />
      <span className={`flex-1 min-w-[8rem] text-big ${i.checked ? "line-through text-ink-soft" : ""}`}>{i.name}</span>
      {i.checked ? (
        <span className="font-display text-big font-bold text-ink-soft min-w-[3.5rem] text-center">{i.qty}</span>
      ) : (
        <Stepper
          label={i.name}
          value={i.qty}
          min={1}
          size="base"
          showLabel={false}
          downLabel={`One fewer ${i.name}`}
          upLabel={`One more ${i.name}`}
          onChange={n => onStep(i, n - i.qty)}
        />
      )}
    </li>
  );
}

export function GroceryScreen() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [name, setName] = useState("");
  const [store, setStore] = useState<Store>("either");
  const [ack, setAck] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get<GroceryItem[]>(`/api/grocery?store=${filter}`)
      .then(setItems)
      .catch(() => setError("Couldn't load the list. Please try again."));
  }
  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function add() {
    if (!name.trim()) return;
    try {
      await api.post("/api/grocery", { name: name.trim(), store });
      setName("");
      setAck("Added to the list");
      load();
    } catch {
      setError("Couldn't add the item. Please try again.");
    }
  }

  async function check(i: GroceryItem) {
    try {
      await api.post(`/api/grocery/${i.id}/check`, { checked: !i.checked });
      load();
    } catch {
      setError("Couldn't save. Please try again.");
    }
  }

  async function step(i: GroceryItem, d: number) {
    if (d === 0) return;
    try {
      await api.post(`/api/grocery/${i.id}/qty`, { qty: i.qty + d });
      load();
    } catch {
      setError("Couldn't save. Please try again.");
    }
  }

  async function clear() {
    try {
      await api.post("/api/grocery/clear-checked");
      setConfirmClear(false);
      setAck("Removed checked items");
      load();
    } catch {
      setConfirmClear(false);
      setError("Couldn't remove the checked items. Please try again.");
    }
  }

  // Group by store for display; within a group, unchecked first then checked (greyed)
  const groups: [Store, GroceryItem[]][] =
    filter === "all"
      ? (["costco", "grocery", "either"] as const).map(s => [s, items.filter(i => i.store === s)])
      : [[filter, items]];
  const anyChecked = items.some(i => i.checked);

  return (
    <div className="flex flex-col gap-6">
      {ack && <Confirmation message={ack} onDone={() => setAck(null)} />}
      {error && <ErrorBanner message={error} onDone={() => setError(null)} />}
      <ScreenTitle>Grocery</ScreenTitle>

      {/* Segmented control — text labels, not color-only */}
      <SegmentedControl label="Which store" options={FILTERS} value={filter} onChange={setFilter} />

      {/* Add item row */}
      <Card as="div" className="!flex-row items-center flex-wrap">
        <label htmlFor="new-grocery" className="sr-only-label">New grocery item</label>
        <input
          id="new-grocery"
          className="field rounded-[20px] px-5 text-big flex-1 min-w-[12rem]"
          placeholder="Add an item"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
        />
        <label htmlFor="new-grocery-store" className="sr-only-label">Store</label>
        <select
          id="new-grocery-store"
          className="field rounded-[20px] px-4 text-base"
          value={store}
          onChange={e => setStore(e.target.value as Store)}
        >
          <option value="either">Either store</option>
          <option value="costco">Costco</option>
          <option value="grocery">Grocery store</option>
        </select>
        <Button onClick={add} icon={<Icon name="plus" strokeWidth={2.8} />}>Add</Button>
      </Card>

      {/* Groups with large section headers */}
      {groups.map(([s, list]) => (
        <Card key={s} title={STORE_LABEL[s]} icon="cart">
          {list.length === 0 ? (
            <p className="m-0 text-base text-ink-soft">
              {filter === "all" ? "Nothing needed." : "Nothing on this list yet."}
            </p>
          ) : (
            <ul className="m-0 p-0 list-none flex flex-col gap-2">
              {[...list]
                .sort((a, b) => Number(a.checked) - Number(b.checked))
                .map(i => <ItemRow key={i.id} i={i} onCheck={check} onStep={step} />)}
            </ul>
          )}
        </Card>
      ))}

      {anyChecked && (
        <div className="flex justify-end">
          <Button variant="secondary" size="base" onClick={() => setConfirmClear(true)} icon={<Icon name="trash" size={26} />}>
            Remove checked items
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Remove all checked items?"
        body="They come off the list for everyone."
        confirmLabel="Remove"
        onConfirm={clear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
