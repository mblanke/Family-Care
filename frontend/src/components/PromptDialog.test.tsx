import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PromptDialog } from "./PromptDialog";

describe("PromptDialog", () => {
  it("returns trimmed values on save and disables save until required fields are filled", () => {
    const onConfirm = vi.fn();
    render(
      <PromptDialog
        open
        title="New dose for Amlodipine"
        helper="Type the dose exactly as written on the label."
        fields={[{ key: "dose", label: "New dose" }, { key: "reason", label: "Reason", optional: true }]}
        confirmLabel="Save dose"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    );
    expect(screen.getByRole("dialog", { name: /new dose for amlodipine/i })).toBeTruthy();
    const save = screen.getByRole("button", { name: /save dose/i }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("New dose"), { target: { value: "  2.5 mg " } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(onConfirm).toHaveBeenCalledWith({ dose: "2.5 mg", reason: "" });
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <PromptDialog open={false} title="x" fields={[{ key: "a", label: "A" }]} onConfirm={() => {}} onCancel={() => {}} />
    );
    expect(container.innerHTML).toBe("");
  });
});
