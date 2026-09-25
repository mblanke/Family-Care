// PersonBadge.tsx — colour + name together, always
import { personStyle, type Person } from "../lib/people";
export function PersonBadge({ person, size = "base" }: { person: Person; size?: "base" | "big" }) {
  return (
    <span style={personStyle(person)}
      className={`inline-flex items-center gap-2 rounded-[14px] border-2 bg-paper/70 px-3 py-1 font-bold
                  ${size === "big" ? "text-big" : "text-base"}`}>
      <span aria-hidden className="w-4 h-4 rounded-full shrink-0" style={{ background: person.color }} />
      {person.name}
    </span>
  );
}
