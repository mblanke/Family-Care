// PersonBadge.tsx — color + name together, always
import { personStyle, type Person } from "../lib/people";
export function PersonBadge({ person }: { person: Person }) {
  return (
    <span style={personStyle(person)}
      className="inline-flex items-center gap-2 border-4 rounded-xl px-3 py-1 text-base font-semibold">
      <span aria-hidden className="w-4 h-4 rounded-full" style={{ background: person.color }} />
      {person.name}
    </span>
  );
}
