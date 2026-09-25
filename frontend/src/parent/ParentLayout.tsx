// parent/ParentLayout.tsx — today-first, six big pills, no month/accounts
import { useState } from "react";
import { NavPills, type NavTab } from "../components/NavPills";
import { Today } from "../screens/Today";
import { TodoScreen } from "../screens/TodoScreen";
import { GroceryScreen } from "../screens/GroceryScreen";
import { Medications } from "../screens/Medications";
import { BpLog } from "../screens/BpLog";
import { Contacts } from "../screens/Contacts";

type Tab = "today" | "todo" | "grocery" | "meds" | "bp" | "contacts";
const TABS: NavTab<Tab>[] = [
  { id: "today", label: "Today", icon: "sun" },
  { id: "todo", label: "To-do", icon: "list" },
  { id: "grocery", label: "Grocery", icon: "cart" },
  { id: "meds", label: "Medications", icon: "pill" },
  { id: "bp", label: "Blood pressure", icon: "heart" },
  { id: "contacts", label: "Contacts", icon: "person" },
];

export function ParentLayout() {
  const [tab, setTab] = useState<Tab>("today");
  return (
    <div className="flex flex-col gap-6">
      <NavPills tabs={TABS} value={tab} onChange={setTab} columns="grid-cols-3 md:grid-cols-6" />
      {tab === "today" && <Today />}
      {tab === "todo" && <TodoScreen />}
      {tab === "grocery" && <GroceryScreen />}
      {tab === "meds" && <Medications />}
      {tab === "bp" && <BpLog />}
      {tab === "contacts" && <Contacts />}
    </div>
  );
}
