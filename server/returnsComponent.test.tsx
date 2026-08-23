// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ processOptions: undefined as { onSuccess?: (result: { returnId: number; returnNumber: string; refundAmount: string }) => void } | undefined }));

vi.mock("@/stores/posStore", () => ({
  usePosStore: (selector?: (state: unknown) => unknown) => {
    const state = { activeLocationId: 3, user: { id: 7, name: "Store Manager", role: "manager" } };
    return selector ? selector(state) : state;
  },
}));
vi.mock("@/lib/trpc", () => ({ trpc: { returns: {
  get: { useQuery: () => ({ data: undefined, isLoading: false, error: null }) },
  recent: { useQuery: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }) },
  process: { useMutation: (options: typeof mocks.processOptions) => { mocks.processOptions = options; return { isPending: false, mutate: vi.fn() }; } },
}, cashSessions: { list: { useQuery: () => ({ data: [], isLoading: false, error: null }) } } } }));

import Returns from "../client/src/pages/Returns";

describe("partial returns workspace", () => {
  afterEach(cleanup);

  it("presents an authorized manager sale lookup with immutable sales-record guidance", () => {
    render(<Returns />);
    expect(screen.getByRole("heading", { name: "Partial returns" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Find original sale" })).toBeInTheDocument();
    expect(screen.getByText(/without editing historical sales/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Sale ID")).toBeInTheDocument();
  });

  it("hands a completed return to a linked replacement sale with its recorded refund", () => {
    render(<Returns />);
    act(() => mocks.processOptions?.onSuccess?.({ returnId: 301, returnNumber: "RET-301", refundAmount: "100.00" }));
    expect(screen.getByText(/Exchange ready/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open linked replacement sale/i })).toHaveAttribute("href", "/register?exchangeReturnId=301&exchangeRefundAmount=100.00");
  });
});
