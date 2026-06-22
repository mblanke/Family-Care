export interface Person { id: number; name: string; slug: string; color: string; }

// Color is ALWAYS paired with the name in the UI — never the only signal.
export function personStyle(p: Person): { borderColor: string } {
  return { borderColor: p.color };
}
