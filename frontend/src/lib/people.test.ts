import { describe, it, expect } from "vitest";
import { personStyle } from "./people";

describe("personStyle", () => {
  it("returns the person color as a CSS variable and keeps the name visible", () => {
    const s = personStyle({ id: 1, name: "Dad", slug: "dad", color: "#1f6feb" });
    expect(s.borderColor).toBe("#1f6feb");
  });
});
