// admin/AdminLayout.tsx — fuller nav; wraps to iPhone width
import { useState } from "react";
import { Today } from "../screens/Today";
import { TodoScreen } from "../screens/TodoScreen";
import { GroceryScreen } from "../screens/GroceryScreen";
import { Schedule } from "../screens/Schedule";
import { Birthdays } from "../screens/Birthdays";
import { Medications } from "../screens/Medications";
import { BpLog } from "../screens/BpLog";
import { MonthView } from "./MonthView";
import { Accounts } from "./Accounts";
import { Contacts } from "../screens/Contacts";
type Tab = "today" | "schedule" | "todo" | "grocery" | "birthdays" | "meds" | "bp" | "accounts" | "contacts";
export function AdminLayout() {
  const [tab, setTab] = useState<Tab>("today");
  const tabs: [Tab, string][] = [["today","Today"],["schedule","Schedule"],["todo","To-do"],
    ["grocery","Grocery"],["birthdays","Birthdays"],["meds","Medications"],["bp","Blood Pressure"],
    ["accounts","Accounts"],["contacts","Contacts"]];
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-touch p-4">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`min-h-touch px-5 text-base font-bold rounded-2xl ${tab === id ? "bg-brand text-paper" : "border-4"}`}>
            {label}</button>
        ))}
      </nav>
      {tab === "today" && <Today />}
      {tab === "schedule" && <><Schedule canEdit /><MonthView /></>}
      {tab === "todo" && <TodoScreen />}
      {tab === "grocery" && <GroceryScreen />}
      {tab === "birthdays" && <Birthdays canEdit />}
      {tab === "meds" && <Medications />}
      {tab === "bp" && <BpLog />}
      {tab === "accounts" && <Accounts />}
      {tab === "contacts" && <Contacts />}
    </div>
  );
}
