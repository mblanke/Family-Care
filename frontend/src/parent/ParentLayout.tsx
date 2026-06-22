// parent/ParentLayout.tsx — today-first, huge tabs, no month/accounts
import { useState } from "react";
import { Today } from "../screens/Today";
type Tab = "today" | "todo" | "grocery";
export function ParentLayout() {
  const [tab, setTab] = useState<Tab>("today");
  const T = ({ id, label }: { id: Tab; label: string }) => (
    <button onClick={() => setTab(id)}
      className={`flex-1 min-h-touch text-big font-bold rounded-2xl ${tab === id ? "bg-brand text-paper" : "border-4"}`}>
      {label}</button>
  );
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex gap-touch p-4">
        <T id="today" label="Today" /><T id="todo" label="To-do" /><T id="grocery" label="Grocery" />
      </nav>
      {tab === "today" && <Today />}
      {/* TodoScreen / GroceryScreen mounted in Tasks 8–9 */}
    </div>
  );
}
