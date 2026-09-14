// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { usePosStore } from "@/stores/posStore";

describe("parked register orders", () => {
  beforeEach(() => {
    sessionStorage.clear();
    usePosStore.setState({ cart: [], selectedMember: null, parkedOrders: [] });
  });

  it("parks a cart and resumes it with its selected member context", () => {
    const store = usePosStore.getState();
    store.addCartItem({ productId: 1, sku: "SKU-1", name: "Rice", unitPrice: "50.00", taxRate: "0.12", isTaxInclusive: true });
    store.setSelectedMember({ id: 9, memberNumber: "PQ-0009", name: "Ana Santos", currentPoints: 12 });
    store.parkCurrentOrder("Ana Santos");
    expect(usePosStore.getState().cart).toHaveLength(0);
    expect(usePosStore.getState().parkedOrders).toHaveLength(1);
    const orderId = usePosStore.getState().parkedOrders[0].id;
    usePosStore.getState().resumeOrder(orderId);
    expect(usePosStore.getState().cart[0].name).toBe("Rice");
    expect(usePosStore.getState().selectedMember?.memberNumber).toBe("PQ-0009");
    expect(usePosStore.getState().parkedOrders).toHaveLength(0);
  });

  it("removes a parked order without affecting the active cart", () => {
    usePosStore.getState().addCartItem({ productId: 2, sku: "SKU-2", name: "Coffee", unitPrice: "80.00", taxRate: "0.12", isTaxInclusive: true });
    usePosStore.getState().parkCurrentOrder();
    const orderId = usePosStore.getState().parkedOrders[0].id;
    usePosStore.getState().removeParkedOrder(orderId);
    expect(usePosStore.getState().parkedOrders).toHaveLength(0);
    expect(usePosStore.getState().cart).toHaveLength(0);
  });
});
