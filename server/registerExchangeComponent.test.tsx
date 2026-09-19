// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/stores/posStore", () => ({
  usePosStore: () => ({ activeLocationId: 3, cart: [{ productId: 9, sku: "SKU-9", name: "Coffee", unitPrice: "150.00", quantity: "1", taxRate: "0.12", isTaxInclusive: false }], selectedMember: null, addCartItem: vi.fn(), updateQuantity: vi.fn(), removeCartItem: vi.fn(), setSelectedMember: vi.fn(), clearCart: vi.fn() }),
}));
vi.mock("@/lib/trpc", () => {
  const query = (data: unknown = []) => ({ data, isLoading: false, error: null, refetch: vi.fn() });
  const mutation = () => ({ isPending: false, mutate: vi.fn(), data: { taxAmount: "18.00", projectedPoints: 1, totalAmount: "150.00" }, error: null });
  return { trpc: {
    inventory: { list: { useQuery: () => query([]) } }, locations: { registers: { useQuery: () => query([]) } },
    cashSessions: { list: { useQuery: () => query([]) }, open: { useMutation: mutation } },
    loyalty: { lookup: { useQuery: () => query(null) }, list: { useQuery: () => query([]) }, registerMember: { useMutation: mutation } }, settings: { posDisplay: { get: { useQuery: () => query("retail") } } }, checkout: { quote: { useMutation: mutation }, complete: { useMutation: mutation }, receipt: { useQuery: () => query(null) } },
  } };
});

import Register from "../client/src/pages/Register";

describe("linked replacement sale", () => {
  afterEach(() => { cleanup(); window.history.replaceState(null, "", "/register"); });

  it("shows the exchange return and recorded refund amount before the replacement checkout", () => {
    window.history.replaceState(null, "", "/register?exchangeReturnId=301&exchangeRefundAmount=100");
    render(<Register />);
    expect(screen.getByText(/Replacement sale linked to return #301/i)).toBeInTheDocument();
    expect(screen.getByText(/refund already issued ₱100\.00/i)).toBeInTheDocument();
    expect(screen.getByText("Net after recorded refund")).toBeInTheDocument();
    expect(screen.getByText("₱50.00")).toBeInTheDocument();
  });

  it("toggles the catalog visibility and tablet layout controls", () => {
    render(<Register />);
    fireEvent.click(screen.getByRole("button", { name: "Hide all products" }));
    expect(screen.getByRole("button", { name: "Show all products" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tablet/ }));
    expect(screen.getByRole("button", { name: /Tablet/ })).toHaveAttribute("aria-pressed", "true");
  });
});
