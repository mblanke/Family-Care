import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TodoScreen } from "./TodoScreen";
import { api } from "../api/client";

vi.mock("../api/client");

beforeEach(() => {
  (api.get as any) = vi.fn().mockResolvedValue([
    { id: 1, text: "Milk", done: false, assignee_id: null, done_at: null },
    { id: 2, text: "Eggs", done: true, assignee_id: null, done_at: "2026-06-22T10:00:00" },
  ]);
});

describe("TodoScreen", () => {
  it("separates open items from the Done area", async () => {
    render(<TodoScreen />);
    await waitFor(() => screen.getByText("Milk"));
    expect(screen.getByText("Done")).toBeTruthy();   // the done section header
    expect(screen.getByText("Eggs")).toBeTruthy();   // completed item still visible
  });
});
