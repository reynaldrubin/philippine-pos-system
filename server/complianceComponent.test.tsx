// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/stores/posStore", () => ({
  usePosStore: (selector?: (state: { user: unknown }) => unknown) => {
    const state = { user: { id: 1, name: "Owner", role: "admin" } };
    return selector ? selector(state) : state;
  },
}));
vi.mock("@/lib/trpc", () => {
  const query = (data: unknown) => ({ data, isLoading: false, refetch: vi.fn() });
  const mutation = () => ({ isPending: false, mutate: vi.fn() });
  return {
    trpc: {
      fiscal: {
        businessProfiles: { useQuery: () => query([{ id: 1, legalName: "Tindahan Retail Inc.", isActive: true }]) },
        taxRegistrations: { useQuery: () => query([]) }, invoiceSeries: { useQuery: () => query([]) }, receiptDevices: { useQuery: () => query([]) }, documents: { useQuery: () => query([]) },
        createBusinessProfile: { useMutation: mutation }, updateBusinessProfile: { useMutation: mutation }, createTaxRegistration: { useMutation: mutation }, updateTaxRegistration: { useMutation: mutation },
        createInvoiceSeries: { useMutation: mutation }, updateInvoiceSeries: { useMutation: mutation }, createReceiptDevice: { useMutation: mutation }, updateReceiptDevice: { useMutation: mutation },
      },
      audit: { list: { useQuery: () => query([]) } },
      locations: { list: { useQuery: () => query([{ id: 2, code: "MNL-01", name: "Manila Store" }]) } },
    },
  };
});

import Compliance from "../client/src/pages/Compliance";

describe("Admin fiscal and audit workspace", () => {
  afterEach(cleanup);

  it("renders fiscal configuration, document history, audit controls, and the non-certification notice", () => {
    render(<Compliance />);
    expect(screen.getByRole("heading", { name: "Fiscal & audit" })).toBeInTheDocument();
    expect(screen.getByText(/do not constitute BIR certification/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Location invoice series" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Operational audit trail" })).toBeInTheDocument();
  });
});
