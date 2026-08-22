import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type StaffRole = "cashier" | "manager" | "admin";
export type StaffUser = { id: number; name: string | null; email: string | null; role: StaffRole };
export type StaffLocation = { id: number; code: string; name: string; type: "store" | "branch" | "warehouse" | "kiosk"; isPrimary: boolean };
export type CartItem = { productId: number; sku: string; name: string; unitPrice: string; quantity: string; taxRate: string; isTaxInclusive: boolean };

export const STAFF_ACCESS_TOKEN_KEY = "pos-staff-access-token";

type PosState = {
  accessToken: string | null;
  user: StaffUser | null;
  locations: StaffLocation[];
  activeLocationId: number | null;
  cart: CartItem[];
  selectedMember: { id: number; memberNumber: string; name: string; currentPoints: number } | null;
  setSession: (session: { accessToken: string; user: StaffUser; locations: StaffLocation[] }) => void;
  clearSession: () => void;
  setActiveLocation: (locationId: number) => void;
  addCartItem: (item: Omit<CartItem, "quantity">) => void;
  updateQuantity: (productId: number, quantity: string) => void;
  removeCartItem: (productId: number) => void;
  clearCart: () => void;
  setSelectedMember: (member: PosState["selectedMember"]) => void;
};

export const usePosStore = create<PosState>()(
  persist(
    (set) => ({
      accessToken: typeof window === "undefined" ? null : sessionStorage.getItem(STAFF_ACCESS_TOKEN_KEY),
      user: null,
      locations: [],
      activeLocationId: null,
      cart: [],
      selectedMember: null,
      setSession: ({ accessToken, user, locations }) => {
        sessionStorage.setItem(STAFF_ACCESS_TOKEN_KEY, accessToken);
        set({ accessToken, user, locations, activeLocationId: locations.find(location => location.isPrimary)?.id ?? locations[0]?.id ?? null });
      },
      clearSession: () => {
        sessionStorage.removeItem(STAFF_ACCESS_TOKEN_KEY);
        set({ accessToken: null, user: null, locations: [], activeLocationId: null, cart: [], selectedMember: null });
      },
      setActiveLocation: activeLocationId => set({ activeLocationId, cart: [], selectedMember: null }),
      addCartItem: item => set(state => {
        const existing = state.cart.find(cartItem => cartItem.productId === item.productId);
        if (existing) return { cart: state.cart.map(cartItem => cartItem.productId === item.productId ? { ...cartItem, quantity: String(Number(cartItem.quantity) + 1) } : cartItem) };
        return { cart: [...state.cart, { ...item, quantity: "1" }] };
      }),
      updateQuantity: (productId, quantity) => set(state => ({ cart: state.cart.map(item => item.productId === productId ? { ...item, quantity } : item) })),
      removeCartItem: productId => set(state => ({ cart: state.cart.filter(item => item.productId !== productId) })),
      clearCart: () => set({ cart: [], selectedMember: null }),
      setSelectedMember: selectedMember => set({ selectedMember }),
    }),
    { name: "pos-staff-state", storage: createJSONStorage(() => sessionStorage), partialize: state => ({ user: state.user, locations: state.locations, activeLocationId: state.activeLocationId }) },
  ),
);

export const getStaffAccessToken = () => typeof window === "undefined" ? null : sessionStorage.getItem(STAFF_ACCESS_TOKEN_KEY);
