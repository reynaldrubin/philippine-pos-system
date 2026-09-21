import { formatRole } from "@/lib/currency";
import { StaffMenuKey, StaffRole, usePosStore } from "@/stores/posStore";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeftRight, BadgePercent, BarChart3, ChevronDown, ChevronRight, ClipboardCheck, LayoutDashboard, LogOut, Menu, Package, ReceiptText, Settings2, ShoppingCart, Store, Undo2, UsersRound, UserCog, WalletCards,
} from "lucide-react";
import React, { ReactNode, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type StaffShellProps = { children: ReactNode };

const navigation = [
  { group: "Workspace", items: [
    { path: "/", key: "overview", label: "Dashboard", icon: LayoutDashboard, roles: ["cashier", "manager", "admin"] },
    { path: "/register", key: "register", label: "Register", icon: ShoppingCart, roles: ["cashier", "manager", "admin"] },
    { path: "/members", key: "members", label: "Loyalty members", icon: UsersRound, roles: ["cashier", "manager", "admin"] },
  ]},
  { group: "Inventory", items: [
    { path: "/inventory", key: "inventory", label: "Products & stock", icon: Package, roles: ["manager", "admin"] },
    { path: "/transfers", key: "transfers", label: "Transfers", icon: ArrowLeftRight, roles: ["manager", "admin"] },
    { path: "/purchase-requests", key: "inventory", label: "Purchase requests", icon: ClipboardCheck, roles: ["manager", "admin"] },
    { path: "/purchase-orders", key: "inventory", label: "Purchase orders", icon: ReceiptText, roles: ["manager", "admin"] },
  ]},
  { group: "Operations", items: [
    { path: "/operations", key: "operations", label: "Cash drawer & attendance", icon: Settings2, roles: ["manager", "admin"] },
  ]},
  { group: "Financials", items: [
    { path: "/cash-controls", key: "operations", label: "Cash controls", icon: WalletCards, roles: ["manager", "admin"] },
    { path: "/cash-close", key: "operations", label: "Closed cash session", icon: ReceiptText, roles: ["manager", "admin"] },
    { path: "/returns", key: "operations", label: "Partial returns", icon: Undo2, roles: ["manager", "admin"] },
  ]},
  { group: "Reports", items: [
    { path: "/reports", key: "reports", label: "Reports", icon: BarChart3, roles: ["manager", "admin"] },
    { path: "/insights", key: "reports", label: "Insights", icon: BarChart3, roles: ["manager", "admin"] },
    { path: "/report-builder", key: "reports", label: "Report builder", icon: ReceiptText, roles: ["manager", "admin"] },
  ]},
  { group: "Configuration", items: [
    { path: "/users", key: "users", label: "Staff creation", icon: UserCog, roles: ["admin"] },
    { path: "/users", key: "users", label: "Access management", icon: UsersRound, roles: ["admin"] },
    { path: "/compliance", key: "compliance", label: "Fiscal & audit", icon: ClipboardCheck, roles: ["admin"] },
    { path: "/store-settings", key: "users", label: "POS display settings", icon: Store, roles: ["admin"] },
  ]},
];

export default function StaffShell({ children }: StaffShellProps) {
  const [location, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const allGroupsCollapsed = useMemo(() => Object.fromEntries(navigation.map(group => [group.group, false])) as Record<string, boolean>, []);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(allGroupsCollapsed);
  const { accessToken, user, locations, menuKeys, activeLocationId, setActiveLocation, setSession, clearSession } = usePosStore();
  const profile = trpc.staffAuth.me.useQuery(undefined, { enabled: Boolean(accessToken), retry: false });
  const visibleNavigation = navigation.map(group => ({ ...group, items: group.items.filter(item => user && item.roles.includes(user.role) && menuKeys.includes(item.key as StaffMenuKey)) })).filter(group => group.items.length);

  useEffect(() => {
    if (accessToken) setExpandedGroups(allGroupsCollapsed);
  }, [accessToken, allGroupsCollapsed]);

  useEffect(() => {
    if (profile.data && accessToken && (["cashier", "manager", "admin"] as string[]).includes(profile.data.user.role)) {
      const staffUser = {
        id: profile.data.user.id,
        name: profile.data.user.name,
        email: profile.data.user.email,
        role: profile.data.user.role as StaffRole,
        jobTitle: profile.data.user.jobTitle,
      };
      setSession({ accessToken, user: staffUser, locations: profile.data.locations, menuKeys: profile.data.menuKeys });
    }
  }, [accessToken, profile.data, setSession]);

  useEffect(() => {
    if (profile.error?.data?.code === "UNAUTHORIZED") {
      clearSession();
      setLocation("/login");
    }
  }, [clearSession, profile.error, setLocation]);

  const activeLocation = locations.find(item => item.id === activeLocationId);

  const signOut = () => {
    clearSession();
    setLocation("/login");
  };

  return (
    <div className="min-h-screen bg-[#f5faf8] text-[#173f3d]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-[#103d3b] px-4 py-5 text-[#f7fbf7] shadow-2xl transition-transform lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <button className="mb-8 flex items-center gap-3 px-2 text-left" onClick={() => setLocation("/")}>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#bceee3] text-[#145b58] shadow-lg"><Store className="h-5 w-5" /></span>
          <span><span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#b9c8c0]">Philippine retail OS</span><span className="text-lg font-semibold tracking-tight">PosQ</span></span>
        </button>
        <nav className="posq-sidebar-scroll min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {visibleNavigation.map(group => <div key={group.group} className="mb-3"><button type="button" aria-label={`${group.group} submenu`} onClick={() => setExpandedGroups(current => ({ ...current, [group.group]: !current[group.group] }))} className="mb-1 flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-[#829b90] hover:text-white"><span aria-hidden="true">{group.group}</span><ChevronRight className={`h-3.5 w-3.5 transition-transform ${expandedGroups[group.group] ? "rotate-90" : ""}`} /></button>{expandedGroups[group.group] && group.items.map(item => {
            const Icon = item.icon;
            const disabled = Boolean((item as { disabled?: boolean }).disabled);
            const active = location === item.path && !disabled;
            return <button key={`${group.group}-${item.label}`} disabled={disabled} onClick={() => { if (!disabled) { setLocation(item.path); setMenuOpen(false); } }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${disabled ? "cursor-not-allowed text-[#6f877c]" : active ? "bg-[#25463d] text-white" : "text-[#c9d7d0] hover:bg-[#1d3831] hover:text-white"}`}>
              <Icon className="h-4 w-4" /> <span>{item.label}</span>{disabled && <span className="ml-auto text-[9px] uppercase tracking-wide text-[#829b90]">Soon</span>}
            </button>;
          })}</div>)}
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
            <button className="grid h-10 w-10 place-items-center rounded-xl border border-[#d9ddd8] bg-white text-[#173f3d] lg:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation"><Menu className="h-5 w-5" /></button>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#74827b]">Active location</p>
              <div className="relative mt-0.5">
                <select value={activeLocationId ?? ""} onChange={event => setActiveLocation(Number(event.target.value))} className="appearance-none bg-transparent pr-6 text-sm font-semibold text-[#173f3d] outline-none">
                  <option value="" disabled>Select location</option>
                  {locations.map(item => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 top-1 h-4 w-4 text-[#74827b]" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block"><p className="text-sm font-semibold leading-none">{user?.name || "Staff account"}</p><p className="mt-1 text-xs text-[#74827b]">{user?.jobTitle || formatRole(user?.role)}</p></div>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#d9f99d] text-sm font-bold text-[#173f3d]">{user?.name?.slice(0, 1).toUpperCase() || "S"}</span>
          </div>
        </header>
        {!activeLocation && <div className="mx-5 mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 lg:mx-8">Select an assigned location to begin operational work.</div>}
        <main className="mx-auto max-w-[1600px] px-5 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
