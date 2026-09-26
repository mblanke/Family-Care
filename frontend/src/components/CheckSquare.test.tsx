import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CheckSquare } from "./CheckSquare";

describe("CheckSquare", () => {
  it("names the item in its label and flips wording when done", () => {
    const onToggle = vi.fn();
    const { rerender } = render(<CheckSquare done={false} itemName="Eggs" onToggle={onToggle} />);
    const btn = screen.getByRole("button", { name: "Mark Eggs done" });
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalled();
    rerender(<CheckSquare done itemName="Eggs" onToggle={onToggle} />);
    expect(screen.getByRole("button", { name: "Mark Eggs not done" }).getAttribute("aria-pressed")).toBe("true");
  });
});
