// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const update = vi.fn();
vi.mock("@/stores/posStore", () => ({ usePosStore: () => ({ user: { id: 1, role: "admin" } }) }));
vi.mock("@/lib/trpc", () => ({ trpc: { settings: { posDisplay: { get: { useQuery: () => ({ data: "retail", refetch: vi.fn() }) }, update: { useMutation: () => ({ mutate: update, isPending: false }) } } } } }));
import StoreSettings from "../client/src/pages/StoreSettings";

describe("Store Settings", () => {
  afterEach(() => { cleanup(); update.mockReset(); });
  it("renders all Philippine retail register layout modes and persists a selection", () => {
    render(<StoreSettings />);
    expect(screen.getByRole("heading", { name: "POS Register Display" })).toBeInTheDocument();
    expect(screen.getByText("Cafe / Food & Beverage")).toBeInTheDocument();
    expect(screen.getByText("Hardware")).toBeInTheDocument();
    expect(screen.getByText("Grocery / Supermarket")).toBeInTheDocument();
    expect(screen.getByText("Standard Retail")).toBeInTheDocument();
    screen.getByRole("button", { name: /Grocery \/ Supermarket/i }).click();
    expect(update).toHaveBeenCalledWith({ mode: "grocery" });
  });
});
