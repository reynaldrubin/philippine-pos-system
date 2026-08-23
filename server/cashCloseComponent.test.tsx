// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/stores/posStore", () => ({
  usePosStore: (selector?: (state: unknown) => unknown) => {
    const state = { activeLocationId: 3, user: { id: 7, name: "Store Manager", role: "manager" } };
    return selector ? selector(state) : state;
  },
}));
vi.mock("@/lib/trpc", () => ({ trpc: { cashSessions: {
  list: { useQuery: () => ({ data: [{ id: 8, registerCode: "POS-01", registerName: "Counter 1", expectedCash: "1000.00" }], isLoading: false, refetch: vi.fn() }) },
  close: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
} } }));

import CashClose from "../client/src/pages/CashClose";

describe("cash close workspace", () => {
  afterEach(cleanup);

  it("requires a visible explanation field for a material calculated variance", () => {
    render(<CashClose />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "8" } });
    fireEvent.change(screen.getByPlaceholderText("Final counted cash in ₱"), { target: { value: "850.00" } });
    expect(screen.getByText(/variance explanation is required/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Explain the material cash difference")).toBeRequired();
  });
});
