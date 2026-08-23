// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/stores/posStore", () => ({
  usePosStore: (selector?: (state: unknown) => unknown) => {
    const state = { activeLocationId: 3, user: { id: 7, name: "Store Manager", role: "manager" } };
    return selector ? selector(state) : state;
  },
}));
vi.mock("@/lib/trpc", () => {
  const query = (data: unknown) => ({ data, isLoading: false, refetch: vi.fn() });
  const mutation = () => ({ isPending: false, mutate: vi.fn() });
  return { trpc: { cashSessions: {
    list: { useQuery: () => query([{ id: 8, registerCode: "POS-01", registerName: "Counter 1", expectedCash: "1000.00" }]) },
    safeDrops: { useQuery: () => query([]) }, pendingVariances: { useQuery: () => query([]) },
    count: { useMutation: mutation }, createSafeDrop: { useMutation: mutation }, reviewSafeDrop: { useMutation: mutation }, approveVariance: { useMutation: mutation },
  } } };
});

import CashControls from "../client/src/pages/CashControls";

describe("cash-control workspace", () => {
  afterEach(cleanup);

  it("renders denomination, safe-drop, and material-variance controls for management", () => {
    render(<CashControls />);
    expect(screen.getByRole("heading", { name: "Cash controls" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Denomination count" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Safe drop" })).toBeInTheDocument();
    expect(screen.getByText(/difference of ₱100 or more/i)).toBeInTheDocument();
  });
});
