import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SegmentedControl } from "./SegmentedControl";

describe("SegmentedControl", () => {
  it("marks the active option with aria-pressed and reports a change", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Which store"
        options={[{ id: "costco", label: "Costco" }, { id: "all", label: "All" }]}
        value="all"
        onChange={onChange}
      />
    );
    expect(screen.getByRole("group", { name: /which store/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Costco" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Costco" }));
    expect(onChange).toHaveBeenCalledWith("costco");
  });
});
