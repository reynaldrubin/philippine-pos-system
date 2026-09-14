import { trpc } from "@/lib/trpc";
import { StaffRole, usePosStore } from "@/stores/posStore";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { getOwnerBootstrapUiState } from "@/lib/ownerBootstrapUi";
import { ArrowRight, LockKeyhole, Store } from "lucide-react";
import React, { FormEvent, useState } from "react";
import { useLocation } from "wouter";

export default function StaffLogin() {
  const [, setLocation] = useLocation();
  const setSession = usePosStore(state => state.setSession);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const { isAuthenticated } = useAuth();
  const bootstrapStatus = trpc.bootstrap.status.useQuery();
  const login = trpc.staffAuth.login.useMutation({ onSuccess: session => {
    if (!(["cashier", "manager", "admin"] as string[]).includes(session.user.role)) return;
    setSession({ ...session, user: { ...session.user, role: session.user.role as StaffRole }, menuKeys: session.menuKeys });
    setLocation("/");
  } });
  const bootstrap = trpc.bootstrap.establishAdminPassword.useMutation({ onSuccess: session => {
    if (!( ["cashier", "manager", "admin"] as string[]).includes(session.user.role)) return;
    setSession({ ...session, user: { ...session.user, role: session.user.role as StaffRole }, menuKeys: session.menuKeys });
    setLocation("/");
  } });
  const ownerBootstrapUiState = getOwnerBootstrapUiState({ isLoading: bootstrapStatus.isLoading, initialized: bootstrapStatus.data?.initialized, isOwnerAuthenticated: isAuthenticated });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ identifier, password });
  };

  return <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
    <section className="relative hidden overflow-hidden bg-[#103d3b] p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_25%,rgba(217,249,157,0.18),transparent_26%),radial-gradient(circle_at_82%_75%,rgba(45,212,191,0.16),transparent_30%)]" />
      <div className="relative flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#bceee3] text-[#145b58]"><Store className="h-5 w-5" /></span><span className="text-xl font-semibold">PosQ</span></div>
      <div className="relative max-w-lg"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d9f99d]">Retail operations, simplified</p><h1 className="mt-4 text-5xl font-semibold leading-[1.05] tracking-tight">One register.<br />Every branch in view.</h1><p className="mt-6 max-w-md text-base leading-7 text-[#c9d7d0]">A Philippine-ready POS workspace for stores, inventory teams, and loyalty members.</p></div>
      <p className="relative text-xs text-[#9bb2a6]">PHP checkout · Multi-location inventory · Loyalty ledger</p>
    </section>
    <section className="flex items-center justify-center bg-[#f5faf8] p-6 sm:p-10"><form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-[#dde3dc] bg-white p-7 shadow-[0_24px_70px_-30px_rgba(16,35,31,0.35)] sm:p-10">
      <div className="mb-9"><div className="mb-5 flex items-center gap-3 lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#17352e] text-[#d9f99d]"><Store className="h-5 w-5" /></span><span className="font-semibold">PosQ</span></div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6b7d73]">Staff access</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#173f3d]">Welcome back</h2><p className="mt-2 text-sm leading-6 text-[#6b7d73]">Sign in with your staff email and password.</p></div>
      <label className="block text-sm font-semibold text-[#273b32]">Email address<input autoComplete="email" value={identifier} onChange={event => setIdentifier(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#d6ded7] bg-[#fbfcfa] px-3 text-sm outline-none transition focus:border-[#3d6d5d] focus:ring-4 focus:ring-[#d9f99d]/50" placeholder="you@store.com" /></label>
      <label className="mt-5 block text-sm font-semibold text-[#273b32]">Password<input autoComplete="current-password" type="password" value={password} onChange={event => setPassword(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#d6ded7] bg-[#fbfcfa] px-3 text-sm outline-none transition focus:border-[#3d6d5d] focus:ring-4 focus:ring-[#d9f99d]/50" placeholder="••••••••" /></label>
      {login.error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{login.error.message}</p>}
      <button disabled={login.isPending} className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#17352e] text-sm font-semibold text-white transition hover:bg-[#25463d] disabled:opacity-60">{login.isPending ? "Signing in…" : "Sign in to workspace"}<ArrowRight className="h-4 w-4" /></button>
      <p className="mt-6 flex items-center justify-center gap-2 text-xs text-[#74827b]"><LockKeyhole className="h-3.5 w-3.5" /> Secure staff access</p>
      <div className="mt-6 border-t border-[#e3e9e3] pt-5"><p className="text-xs font-semibold text-[#52655b]">First-time project owner?</p>{ownerBootstrapUiState === "checking" ? <p className="mt-2 text-xs text-[#74827b]">Checking Admin setup…</p> : ownerBootstrapUiState === "initialized" ? <p className="mt-2 text-xs leading-5 text-[#52655b]">An Admin account is already initialized. Sign in above with the configured staff email and password.</p> : ownerBootstrapUiState === "set-admin-password" ? <div className="mt-3 flex gap-2"><input type="password" value={adminPassword} onChange={event => setAdminPassword(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-[#d6ded7] px-2 text-xs" placeholder="Set 12+ character Admin password" /><button type="button" disabled={adminPassword.length < 12 || bootstrap.isPending} onClick={() => bootstrap.mutate({ password: adminPassword })} className="rounded-lg border border-[#2f644e] px-3 text-xs font-semibold text-[#24513f]">Initialize</button></div> : <button type="button" onClick={() => startLogin()} className="mt-2 text-xs font-semibold text-[#2c654f] underline underline-offset-4">Sign in as project owner to initialize Admin</button>}{bootstrap.error && <p className="mt-2 text-xs text-red-700">{bootstrap.error.message}</p>}</div>
    </form></section>
  </div>;
}
