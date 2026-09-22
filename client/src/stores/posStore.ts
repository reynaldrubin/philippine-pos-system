import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type StaffRole = "cashier" | "manager" | "admin";
export type StaffMenuKey = "overview" | "register" | "inventory" | "transfers" | "members" | "operations" | "reports" | "users" | "compliance" | "hris";
export type StaffUser = { id: number; name: string | null; email: string | null; role: StaffRole; jobTitle?: string | null };
export type StaffLocation = { id: number; code: string; name: string; type: "store" | "branch" | "warehouse" | "kiosk"; isPrimary: boolean };
export type CartItem = { productId: number; sku: string; name: string; unitPrice: string; quantity: string; taxRate: string; isTaxInclusive: boolean };
export type ParkedOrder = { id: string; label: string; createdAt: number; cart: CartItem[]; selectedMember: PosState["selectedMember"] };

export const STAFF_ACCESS_TOKEN_KEY = "pos-staff-access-token";

type PosState = {
  accessToken: string | null;
  user: StaffUser | null;
  locations: StaffLocation[];
  menuKeys: StaffMenuKey[];
  activeLocationId: number | null;
  cart: CartItem[];
  selectedMember: { id: number; memberNumber: string; name: string; currentPoints: number } | null;
  parkedOrders: ParkedOrder[];
  setSession: (session: { accessToken: string; user: StaffUser; locations: StaffLocation[]; menuKeys?: StaffMenuKey[] }) => void;
  clearSession: () => void;
  setActiveLocation: (locationId: number) => void;
  addCartItem: (item: Omit<CartItem, "quantity">) => void;
  updateQuantity: (productId: number, quantity: string) => void;
  removeCartItem: (productId: number) => void;
  clearCart: () => void;
  setSelectedMember: (member: PosState["selectedMember"]) => void;
  parkCurrentOrder: (label?: string) => void;
  resumeOrder: (orderId: string) => void;
  removeParkedOrder: (orderId: string) => void;
};

export const usePosStore = create<PosState>()(
  persist(
    (set) => ({
      accessToken: typeof window === "undefined" ? null : sessionStorage.getItem(STAFF_ACCESS_TOKEN_KEY),
      user: null, locations: [], menuKeys: [], activeLocationId: null, cart: [], selectedMember: null, parkedOrders: [],
      setSession: ({ accessToken, user, locations, menuKeys = [] }) => { sessionStorage.setItem(STAFF_ACCESS_TOKEN_KEY, accessToken); set({ accessToken, user, locations, menuKeys, activeLocationId: locations.find(location => location.isPrimary)?.id ?? locations[0]?.id ?? null }); },
      clearSession: () => { sessionStorage.removeItem(STAFF_ACCESS_TOKEN_KEY); set({ accessToken: null, user: null, locations: [], menuKeys: [], activeLocationId: null, cart: [], selectedMember: null, parkedOrders: [] }); },
      setActiveLocation: activeLocationId => set({ activeLocationId, cart: [], selectedMember: null }),
      addCartItem: item => set(state => { const existing = state.cart.find(cartItem => cartItem.productId === item.productId); if (existing) return state; return { cart: [...state.cart, { ...item, quantity: "1" }] }; }),
      updateQuantity: (productId, quantity) => set(state => ({ cart: state.cart.map(item => item.productId === productId ? { ...item, quantity } : item) })),
      removeCartItem: productId => set(state => ({ cart: state.cart.filter(item => item.productId !== productId) })),
      clearCart: () => set({ cart: [], selectedMember: null }),
      setSelectedMember: selectedMember => set({ selectedMember }),
      parkCurrentOrder: (label = "Walk-in customer") => set(state => state.cart.length ? { parkedOrders: [{ id: crypto.randomUUID(), label, createdAt: Date.now(), cart: state.cart, selectedMember: state.selectedMember }, ...state.parkedOrders], cart: [], selectedMember: null } : state),
      resumeOrder: orderId => set(state => { const order = state.parkedOrders.find(item => item.id === orderId); if (!order) return state; return { cart: order.cart, selectedMember: order.selectedMember, parkedOrders: state.parkedOrders.filter(item => item.id !== orderId) }; }),
      removeParkedOrder: orderId => set(state => ({ parkedOrders: state.parkedOrders.filter(item => item.id !== orderId) })),
    }),
    { name: "pos-staff-state", storage: createJSONStorage(() => sessionStorage), partialize: state => ({ user: state.user, locations: state.locations, menuKeys: state.menuKeys, activeLocationId: state.activeLocationId, parkedOrders: state.parkedOrders }) },
  ),
);

export const getStaffAccessToken = () => typeof window === "undefined" ? null : sessionStorage.getItem(STAFF_ACCESS_TOKEN_KEY);
