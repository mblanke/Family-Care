import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { GroceryScreen } from "./GroceryScreen";
import { api } from "../api/client";

vi.mock("../api/client");
beforeEach(() => {
  (api.get as any) = vi.fn().mockResolvedValue([
    { id: 1, name: "Eggs", store: "costco", qty: 1, checked: false },
    { id: 2, name: "Milk", store: "grocery", qty: 2, checked: false },
  ]);
});

describe("GroceryScreen", () => {
  it("shows the store segmented control with Costco/Grocery/All", async () => {
    render(<GroceryScreen />);
    await waitFor(() => screen.getByText("Eggs"));
    expect(screen.getByRole("button", { name: /costco/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /grocery/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^all$/i })).toBeTruthy();
  });
});
