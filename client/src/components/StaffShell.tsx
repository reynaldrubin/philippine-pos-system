import { formatRole } from "@/lib/currency";
import { StaffRole, usePosStore } from "@/stores/posStore";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeftRight, BadgePercent, ChevronDown, LayoutDashboard, LogOut, Menu, Package, ReceiptText, Settings2, ShoppingCart, Store, UsersRound,
} from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";

type StaffShellProps = { children: ReactNode };

const navigation = [
  { path: "/", label: "Overview", icon: LayoutDashboard, roles: ["cashier", "manager", "admin"] },
  { path: "/register", label: "Register", icon: ShoppingCart, roles: ["cashier", "manager", "admin"] },
  { path: "/inventory", label: "Inventory", icon: Package, roles: ["manager", "admin"] },
  { path: "/transfers", label: "Transfers", icon: ArrowLeftRight, roles: ["manager", "admin"] },
  { path: "/members", label: "Loyalty members", icon: UsersRound, roles: ["cashier", "manager", "admin"] },
  { path: "/operations", label: "Operations", icon: Settings2, roles: ["manager", "admin"] },
];

export default function StaffShell({ children }: StaffShellProps) {
  const [location, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { accessToken, user, locations, activeLocationId, setActiveLocation, setSession, clearSession } = usePosStore();
  const profile = trpc.staffAuth.me.useQuery(undefined, { enabled: Boolean(accessToken), retry: false });

  useEffect(() => {
    if (profile.data && accessToken && (["cashier", "manager", "admin"] as string[]).includes(profile.data.user.role)) {
      const staffUser = {
        id: profile.data.user.id,
        name: profile.data.user.name,
        email: profile.data.user.email,
        role: profile.data.user.role as StaffRole,
      };
      setSession({ accessToken, user: staffUser, locations: profile.data.locations });
    }
  }, [accessToken, profile.data, setSession]);

  useEffect(() => {
    if (profile.error?.data?.code === "UNAUTHORIZED") {
      clearSession();
      setLocation("/login");
    }
  }, [clearSession, profile.error, setLocation]);

  const activeLocation = locations.find(item => item.id === activeLocationId);
  const visibleNavigation = navigation.filter(item => user && item.roles.includes(user.role));

  const signOut = () => {
    clearSession();
    setLocation("/login");
  };

  return (
    <div className="min-h-screen bg-[#f5f6f3] text-[#1f2933]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-[#10231f] px-4 py-5 text-[#f7fbf7] shadow-2xl transition-transform lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <button className="mb-8 flex items-center gap-3 px-2 text-left" onClick={() => setLocation("/")}>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d9f99d] text-[#17352e] shadow-lg"><Store className="h-5 w-5" /></span>
          <span><span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#b9c8c0]">Philippine retail</span><span className="text-lg font-semibold tracking-tight">Tindahan OS</span></span>
        </button>
        <nav className="space-y-1">
          {visibleNavigation.map(item => {
            const Icon = item.icon;
            const active = location === item.path;
            return <button key={item.path} onClick={() => { setLocation(item.path); setMenuOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-[#25463d] text-white" : "text-[#c9d7d0] hover:bg-[#1d3831] hover:text-white"}`}>
              <Icon className="h-4 w-4" /> {item.label}
            </button>;
          })}
        </nav>
        <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-2 text-xs text-[#c9d7d0]"><BadgePercent className="h-3.5 w-3.5 text-[#d9f99d]" /> Loyalty rule active</div>
          <p className="mt-1 text-sm font-semibold text-white">1 point / ₱100</p>
          <p className="mt-1 text-[11px] leading-4 text-[#b9c8c0]">Earned only after a successful sale.</p>
        </div>
        <button onClick={signOut} className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#c9d7d0] transition hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" /> Sign out</button>
      </aside>

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#d9ddd8] bg-[#f5f6f3]/90 px-5 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button className="grid h-10 w-10 place-items-center rounded-xl border border-[#d9ddd8] bg-white text-[#17352e] lg:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation"><Menu className="h-5 w-5" /></button>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#74827b]">Active location</p>
              <div className="relative mt-0.5">
                <select value={activeLocationId ?? ""} onChange={event => setActiveLocation(Number(event.target.value))} className="appearance-none bg-transparent pr-6 text-sm font-semibold text-[#17352e] outline-none">
                  <option value="" disabled>Select location</option>
                  {locations.map(item => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 top-1 h-4 w-4 text-[#74827b]" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block"><p className="text-sm font-semibold leading-none">{user?.name || "Staff account"}</p><p className="mt-1 text-xs text-[#74827b]">{formatRole(user?.role)}</p></div>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#d9f99d] text-sm font-bold text-[#17352e]">{user?.name?.slice(0, 1).toUpperCase() || "S"}</span>
          </div>
        </header>
        {!activeLocation && <div className="mx-5 mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:mx-8">Select an assigned location to begin operational work.</div>}
        <main className="mx-auto max-w-[1600px] px-5 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
