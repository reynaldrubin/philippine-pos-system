import { trpc } from "@/lib/trpc";
import { MEMBER_ACCESS_TOKEN_KEY, useMemberPortalStore } from "@/stores/memberPortalStore";
import { Award, ChevronRight, CircleDollarSign, Clock3, LogOut, QrCode, ReceiptText, ShieldCheck, Sparkles } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const number = new Intl.NumberFormat("en-PH");
const formattedDate = (value: Date | string | number | null | undefined) => value ? new Date(value).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";
const friendlyType = (type: string) => type.replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase());

export default function MemberPortal() {
  const accessToken = useMemberPortalStore(state => state.accessToken);
  return accessToken ? <MemberPortalDashboard /> : <MemberPortalLogin />;
}

function PortalBrand() {
  return <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d9f99d] text-[#17352e]"><Award className="h-5 w-5" /></span><span><span className="block text-base font-semibold tracking-tight">Tindahan Rewards</span><span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#b7cdc0]">Loyalty member portal</span></span></div>;
}

function MemberPortalLogin() {
  const [, setLocation] = useLocation();
  const setSession = useMemberPortalStore(state => state.setSession);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.memberAuth.login.useMutation({
    onSuccess: session => {
      setSession({ accessToken: session.accessToken, member: session.member, points: session.points });
      setLocation("/portal");
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ identifier, password });
  };

  return <main className="min-h-screen bg-[#f4f6f2] text-[#17352e]"><div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]"><section className="relative overflow-hidden bg-[#102b24] px-7 py-10 text-white sm:px-12 lg:flex lg:flex-col lg:justify-between lg:p-14"><div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_22%,rgba(217,249,157,0.18),transparent_24%),radial-gradient(circle_at_78%_78%,rgba(45,212,191,0.16),transparent_32%)]" /><div className="relative"><PortalBrand /></div><div className="relative mt-20 max-w-xl lg:mt-0"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d9f99d]">Loyalty made visible</p><h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">Your rewards.<br />In clear view.</h1><p className="mt-6 max-w-md text-base leading-7 text-[#c3d4cc]">Track eligible purchases, see every points movement, and keep your QR e-card ready for checkout.</p><div className="mt-10 grid max-w-lg grid-cols-3 gap-3 text-xs text-[#bfd3c9]"><div className="rounded-xl border border-white/10 bg-white/5 p-3"><ReceiptText className="mb-3 h-4 w-4 text-[#d9f99d]" />Purchase history</div><div className="rounded-xl border border-white/10 bg-white/5 p-3"><CircleDollarSign className="mb-3 h-4 w-4 text-[#d9f99d]" />₱100 = 1 point</div><div className="rounded-xl border border-white/10 bg-white/5 p-3"><QrCode className="mb-3 h-4 w-4 text-[#d9f99d]" />E-member card</div></div></div><p className="relative mt-14 text-xs text-[#9eb5aa]">Points are earned on qualifying net purchases after discounts and before tax.</p></section><section className="flex items-center justify-center p-6 sm:p-10"><form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-[#dde4dc] bg-white p-7 shadow-[0_24px_70px_-32px_rgba(16,43,36,0.35)] sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6b7d73]">Member access</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Welcome back</h2><p className="mt-2 text-sm leading-6 text-[#6b7d73]">Sign in with the mobile number or email and password set when your card was issued.</p><label className="mt-8 block text-sm font-semibold text-[#273b32]">Mobile number or email<input required value={identifier} onChange={event => setIdentifier(event.target.value)} autoComplete="username" className="mt-2 h-12 w-full rounded-xl border border-[#d6ded7] bg-[#fbfcfa] px-3 text-sm outline-none transition focus:border-[#3d6d5d] focus:ring-4 focus:ring-[#d9f99d]/50" placeholder="0917 123 4567 or you@email.com" /></label><label className="mt-5 block text-sm font-semibold text-[#273b32]">Portal password<input required type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" className="mt-2 h-12 w-full rounded-xl border border-[#d6ded7] bg-[#fbfcfa] px-3 text-sm outline-none transition focus:border-[#3d6d5d] focus:ring-4 focus:ring-[#d9f99d]/50" placeholder="••••••••" /></label>{login.error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{login.error.message}</p>}<button disabled={login.isPending} className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#17352e] text-sm font-semibold text-white transition hover:bg-[#25463d] disabled:opacity-60">{login.isPending ? "Signing in…" : "View my rewards"}<ChevronRight className="h-4 w-4" /></button><div className="mt-7 border-t border-[#e3e9e3] pt-5"><Link href="/login" className="text-xs font-semibold text-[#2c654f] underline underline-offset-4">Staff member? Sign in to the workspace</Link><p className="mt-3 flex items-center gap-2 text-xs text-[#74827b]"><ShieldCheck className="h-3.5 w-3.5" /> Your card and purchase activity stay private.</p></div></form></section></div></main>;
}

function MemberPortalDashboard() {
  const [, setLocation] = useLocation();
  const clearSession = useMemberPortalStore(state => state.clearSession);
  const summary = trpc.loyalty.myPortalSummary.useQuery(undefined, { retry: false });
  const purchases = trpc.loyalty.myPortalPurchases.useQuery(undefined, { retry: false });
  const ledger = trpc.loyalty.myPortalPoints.useQuery(undefined, { retry: false });
  const card = trpc.loyalty.myPortalCard.useQuery(undefined, { retry: false });
  const isLoading = summary.isLoading || purchases.isLoading || ledger.isLoading || card.isLoading;
  const failure = summary.error || purchases.error || ledger.error || card.error;
  const dashboard = summary.data;
  const member = dashboard?.member;
  const account = dashboard?.account;
  const token = card.data?.displayToken || member?.memberNumber || "";
  const firstName = member?.firstName || "Member";
  const currentPoints = account?.currentPoints ?? 0;
  const totalSpend = useMemo(() => (purchases.data ?? []).reduce((sum, sale) => sum + Number(sale.totalAmount), 0), [purchases.data]);

  useEffect(() => {
    if (failure?.data?.code === "UNAUTHORIZED") {
      clearSession();
      setLocation("/portal");
    }
  }, [clearSession, failure?.data?.code, setLocation]);

  const logout = () => {
    clearSession();
    sessionStorage.removeItem(MEMBER_ACCESS_TOKEN_KEY);
    setLocation("/portal");
  };

  if (isLoading) return <PortalLoading />;
  if (failure || !member || !account) return <main className="grid min-h-screen place-items-center bg-[#f4f6f2] p-6"><section className="max-w-md rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm"><p className="text-sm font-semibold text-red-800">We could not load your loyalty profile.</p><p className="mt-2 text-sm text-[#68776f]">{failure?.message || "Please sign in again to continue."}</p><button onClick={logout} className="mt-6 rounded-xl bg-[#17352e] px-4 py-2 text-sm font-semibold text-white">Return to member sign-in</button></section></main>;

  return <main className="min-h-screen bg-[#f4f6f2] text-[#17352e]"><header className="border-b border-[#dfe7df] bg-[#102b24] text-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8"><PortalBrand /><div className="flex items-center gap-3"><span className="hidden text-right text-xs text-[#bfd3c9] sm:block">Signed in as<br /><strong className="font-semibold text-white">{firstName} {member.lastName}</strong></span><button onClick={logout} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs font-semibold text-white transition hover:bg-white/10"><LogOut className="h-3.5 w-3.5" /> Sign out</button></div></div></header><div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10"><section className="rounded-3xl bg-[#102b24] p-6 text-white shadow-[0_22px_55px_-30px_rgba(16,43,36,0.7)] sm:p-8"><div className="grid gap-7 lg:grid-cols-[1fr_auto]"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d9f99d]">Tindahan Rewards · {member.memberNumber}</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Hello, {firstName}.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#bfd3c9]">Every purchase and point movement is shown here. Present your e-member card before payment at any participating register.</p><div className="mt-7 flex flex-wrap gap-3"><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs text-[#e2eee8]"><Sparkles className="h-3.5 w-3.5 text-[#d9f99d]" /> Active member</span><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs text-[#e2eee8]"><Clock3 className="h-3.5 w-3.5 text-[#d9f99d]" /> Joined {formattedDate(member.createdAt)}</span></div></div><div className="rounded-2xl border border-white/10 bg-white/[0.07] p-5 lg:w-72"><p className="text-xs font-semibold text-[#bfd3c9]">Available balance</p><p className="mt-2 text-5xl font-semibold tracking-tight text-[#d9f99d]">{number.format(currentPoints)}</p><p className="mt-1 text-sm text-[#bfd3c9]">loyalty points</p><p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-[#b7cec2]">Earn 1 point for every full ₱100 of qualifying spend, after discounts and before tax.</p></div></div></section><section className="mt-6 grid gap-4 sm:grid-cols-3"><Metric label="Lifetime earned" value={number.format(account.lifetimeEarned ?? 0)} suffix="points" icon={<Award className="h-5 w-5" />} /><Metric label="Lifetime redeemed" value={number.format(account.lifetimeRedeemed ?? 0)} suffix="points" icon={<Sparkles className="h-5 w-5" />} /><Metric label="Recent purchase total" value={peso.format(totalSpend)} suffix={`${purchases.data?.length ?? 0} purchases shown`} icon={<ReceiptText className="h-5 w-5" />} /></section><section className="mt-6 grid gap-6 xl:grid-cols-[0.78fr_1.22fr]"><article className="rounded-3xl border border-[#dce4dd] bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6c7e73]">Your e-card</p><h2 className="mt-1 text-xl font-semibold">Ready to scan</h2></div><QrCode className="h-5 w-5 text-[#2e6853]" /></div><div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-[#b5cbb9] bg-[#fbfdf9] p-5"><QRCodeSVG value={token} size={176} bgColor="#fbfdf9" fgColor="#17352e" includeMargin /><p className="mt-4 break-all text-center font-mono text-[10px] text-[#587064]">{token}</p><p className="mt-3 text-center text-xs leading-5 text-[#728279]">Show this QR code before checkout so your qualifying purchase and points are linked to your account.</p></div><dl className="mt-5 grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-[#f5f8f4] p-3"><dt className="text-[#77877e]">Member number</dt><dd className="mt-1 font-semibold text-[#294137]">{member.memberNumber}</dd></div><div className="rounded-xl bg-[#f5f8f4] p-3"><dt className="text-[#77877e]">Card status</dt><dd className="mt-1 font-semibold capitalize text-[#294137]">{card.data?.cardStatus || "active"}</dd></div></dl></article><article className="rounded-3xl border border-[#dce4dd] bg-white p-6 shadow-sm"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6c7e73]">Purchase history</p><h2 className="mt-1 text-xl font-semibold">Recent visits</h2></div><span className="text-xs text-[#728279]">Last 30 purchases</span></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[490px] text-left text-sm"><thead className="border-b border-[#e4ebe4] text-xs uppercase tracking-wide text-[#74837a]"><tr><th className="pb-3 font-semibold">Receipt</th><th className="pb-3 font-semibold">Date</th><th className="pb-3 text-right font-semibold">Purchase</th><th className="pb-3 text-right font-semibold">Points</th></tr></thead><tbody>{purchases.data?.length ? purchases.data.map(sale => <tr key={sale.id} className="border-b border-[#edf1ed] last:border-0"><td className="py-4 font-medium text-[#264336]">{sale.receiptNumber}</td><td className="py-4 text-[#687970]">{formattedDate(sale.createdAt)}</td><td className="py-4 text-right font-medium">{peso.format(Number(sale.totalAmount))}</td><td className="py-4 text-right font-semibold text-[#2d7356]">+{number.format(sale.pointsEarned)} <span className="font-normal text-[#74837a]">pts</span></td></tr>) : <tr><td colSpan={4} className="py-12 text-center text-sm text-[#74837a]">Your qualifying purchase history will appear here after checkout.</td></tr>}</tbody></table></div></article></section><section className="mt-6 rounded-3xl border border-[#dce4dd] bg-white p-6 shadow-sm"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6c7e73]">Immutable ledger</p><h2 className="mt-1 text-xl font-semibold">Points activity</h2></div><p className="text-xs text-[#728279]">Each entry is permanent</p></div><div className="mt-5 divide-y divide-[#e9efea]">{ledger.data?.length ? ledger.data.map(entry => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-medium text-[#294137]">{friendlyType(entry.type)}</p><p className="mt-1 text-xs text-[#728279]">{formattedDate(entry.createdAt)}{entry.note ? ` · ${entry.note}` : ""}</p></div><div className="text-right"><p className={entry.points >= 0 ? "font-semibold text-[#287553]" : "font-semibold text-[#b54a3a]"}>{entry.points >= 0 ? "+" : ""}{number.format(entry.points)} points</p><p className="mt-1 text-xs text-[#728279]">Balance after: {number.format(entry.balanceAfter)}</p></div></div>) : <div className="py-12 text-center text-sm text-[#74837a]">Point earnings and adjustments will appear here after your first qualifying purchase.</div>}</div></section></div></main>;
}

function Metric({ label, value, suffix, icon }: { label: string; value: string; suffix: string; icon: React.ReactNode }) {
  return <article className="rounded-2xl border border-[#dce4dd] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#718179]">{label}</p><span className="text-[#2e6853]">{icon}</span></div><p className="mt-5 text-2xl font-semibold tracking-tight text-[#1c352b]">{value}</p><p className="mt-1 text-xs text-[#74837a]">{suffix}</p></article>;
}

function PortalLoading() {
  return <main className="grid min-h-screen place-items-center bg-[#f4f6f2]"><div className="text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#17352e] text-[#d9f99d]"><Award className="h-5 w-5" /></span><p className="mt-4 text-sm font-medium text-[#426052]">Loading your rewards…</p></div></main>;
}
