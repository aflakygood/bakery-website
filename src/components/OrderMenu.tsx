import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Calendar, MapPin, Minus, Plus, Check, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { pickupWhen, type PickupFields } from "@/lib/pickup";
import { closesLabel, dropPhase, useNow, type DropSchedule } from "@/lib/drop";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import SmsDisclosure from "@/components/SmsDisclosure";
import { itemImage } from "@/lib/itemImage";
import { EMAIL_RE, US_PHONE_RE } from "@/lib/contact";

type Item = { id: string; name: string; description: string; ingredients: string; price_cents: number; min_per_order: number; max_per_order: number; remaining: number; image_url: string | null; group_id: string | null };
type DropRow = PickupFields & DropSchedule & { id: string; title: string };
type Confirmation = {
  customer_name: string;
  items: { name: string; qty: number; price_cents: number }[];
  total_cents: number;
  subtotal_cents?: number;
  discount_percent?: number | null;
  sms_opt_in: boolean;
  has_phone?: boolean;
  email?: string | null;
  email_sent?: boolean;
  pickup: PickupFields | null;
  pickup_address: string | null;
};
type OrderRef = { order_id: string; checkout_token: string };

declare global {
  interface Window {
    appendHelcimPayIframe?: (token: string, allowExit?: boolean) => void;
    removeHelcimPayIframe?: () => void;
  }
}

const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

function loadHelcim() {
  return new Promise<void>((resolve, reject) => {
    if (window.appendHelcimPayIframe) return resolve();
    const s = document.createElement("script");
    s.src = "https://secure.helcim.app/helcim-pay/services/start.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load payment window"));
    document.body.appendChild(s);
  });
}

async function errText(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try { return (await error.context.json()).error ?? "Something went wrong."; } catch { /* ignore */ }
  }
  return "Something went wrong. Please try again.";
}

const emailError = (email: string) => {
  if (!email.trim()) return "Enter your email address so we can send your order confirmation.";
  if (!EMAIL_RE.test(email.trim())) return "Enter a valid email address (e.g. name@example.com).";
  return "";
};
const PHONE_HINT = "e.g. 4255550123";
const phoneError = (phone: string, required = false) => {
  if (!phone) return required ? "Enter phone number to receive order and pickup updates." : "";
  if (phone.length < 10) return `Phone number must be exactly 10 digits — you've entered ${phone.length} (${PHONE_HINT}).`;
  if (!US_PHONE_RE.test(phone)) return `Enter a valid US phone number — the area code and the next 3 digits can't start with 0 or 1 (${PHONE_HINT}).`;
  return "";
};
// Keeps digits only. Pasted numbers drop a leading US country code (+1); typed input is capped at 10 digits.
const cleanPhone = (raw: string, prev: string) => {
  let digits = raw.replace(/\D/g, "");
  const pasted = digits.length - prev.length > 1;
  if (pasted && digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  let notice = "";
  if (!pasted && /\D/.test(raw)) notice = `Numbers only — don't include +, spaces, dashes or brackets (${PHONE_HINT}).`;
  if (digits.length > 10) {
    digits = digits.slice(0, 10);
    notice = `US phone numbers are exactly 10 digits — you can't enter more than 10 (${PHONE_HINT}).`;
  }
  return { digits, notice };
};

export default function OrderMenu() {
  const reduceMotion = useReducedMotion();
  const [drop, setDrop] = useState<DropRow | null>(null);
  const [loaded, setLoaded] = useState(!isSupabaseConfigured);
  const now = useNow();
  const [items, setItems] = useState<Item[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [form, setForm] = useState({ customer_name: "", email: "", phone: "", sms_opt_in: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [phoneMsg, setPhoneMsg] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [orderRef, setOrderRef] = useState<OrderRef | null>(null);

  const load = async () => {
    if (!isSupabaseConfigured) return;
    const { data: d } = await supabase.from("drops").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!d) { setLoaded(true); return; }
    setDrop(d);
    const { data: its } = await supabase.from("drop_items").select("*").eq("drop_id", d.id).order("sort");
    const withRemaining = await Promise.all(
      (its ?? []).map(async (i) => {
        const { data: r } = await supabase.rpc("item_remaining", { _item_id: i.id });
        return { ...i, remaining: Math.max(0, r ?? 0) };
      }),
    );
    setItems(withRemaining);
    setLoaded(true);
  };
  useEffect(() => { load(); }, []);

  const phase = drop ? dropPhase(drop, now) : "upcoming";
  const closed = phase === "ended" || phase === "closed";
  const soldOut = !closed && items.length > 0 && items.every((i) => i.remaining === 0);
  const open = phase === "open" && !soldOut;
  const total = useMemo(() => items.reduce((s, i) => s + (qty[i.id] ?? 0) * i.price_cents, 0), [items, qty]);

  // Secret codes in brackets in the name, e.g. "Ayush (friends)". The server re-checks at checkout.
  const [discountPct, setDiscountPct] = useState<number | null>(null);
  useEffect(() => {
    const name = form.customer_name;
    if (!isSupabaseConfigured || !/\([^()]+\)/.test(name)) { setDiscountPct(null); return; }
    let stale = false;
    const t = setTimeout(async () => {
      const { data } = await supabase.functions.invoke("check-discount", { body: { name } });
      if (!stale) setDiscountPct(typeof data?.percent === "number" ? data.percent : null);
    }, 400);
    return () => { stale = true; clearTimeout(t); };
  }, [form.customer_name]);
  const payTotal = discountPct ? total - Math.round((total * discountPct) / 100) : total;

  // Grouped items share spots, so other cart items in the same group use up this item's availability.
  const avail = (i: Item) =>
    Math.max(0, i.remaining - (i.group_id ? items.reduce((s, o) => s + (o.id !== i.id && o.group_id === i.group_id ? qty[o.id] ?? 0 : 0), 0) : 0));

  // Some items have a minimum per order, waived when fewer than that are left.
  const minFor = (i: Item) => Math.max(1, Math.min(i.min_per_order ?? 1, avail(i)));
  const belowMin = (i: Item, n: number) => n > 0 && n < minFor(i);

  const [limitMsg, setLimitMsg] = useState<Record<string, string>>({});
  const change = (i: Item, d: number) => {
    const cur = qty[i.id] ?? 0;
    let next = cur + d;
    if (d > 0 && cur === 0) next = minFor(i);
    if (d < 0 && belowMin(i, next)) next = 0;
    const left = avail(i);
    if (d > 0 && next > Math.min(i.max_per_order, left)) {
      setLimitMsg((m) => ({ ...m, [i.id]: next > left ? "no more available this week." : "that's the most you can order." }));
      return;
    }
    setLimitMsg((m) => ({ ...m, [i.id]: "" }));
    setQty((q) => ({ ...q, [i.id]: Math.max(0, next) }));
  };

  const [sel, setSel] = useState<Item | null>(null);
  const [mQty, setMQty] = useState(1);
  const [mMsg, setMMsg] = useState("");
  // The details sheet gets its own history entry so the hardware back button only dismisses it.
  const closeItem = () => {
    if (window.history.state?.itemSheet) window.history.back();
    else setSel(null);
  };
  useEffect(() => {
    const onPop = () => setSel(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const openItem = (i: Item) => {
    if (!window.history.state?.itemSheet) window.history.pushState({ ...window.history.state, itemSheet: true }, "");
    setSel(i); setMQty(Math.max(minFor(i), qty[i.id] ?? 0)); setMMsg("");
  };
  const mChange = (d: number) => {
    if (!sel) return;
    const next = mQty + d;
    const left = avail(sel);
    if (d > 0 && next > Math.min(sel.max_per_order, left)) {
      setMMsg(next > left ? "no more available this week." : "that's the most you can order.");
      return;
    }
    setMMsg("");
    setMQty(Math.max(minFor(sel), next));
  };
  useEffect(() => {
    if (!sel) return;
    document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => e.key === "Escape" && closeItem();
    window.addEventListener("keydown", k);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", k); };
  }, [sel]);

  const checkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drop) return;
    setError("");
    const lines = Object.entries(qty).filter(([, n]) => n > 0).map(([item_id, n]) => ({ item_id, qty: n }));
    if (!lines.length) return setError("Pick at least one item.");
    const short = items.find((i) => belowMin(i, qty[i.id] ?? 0));
    if (short) {
      setLimitMsg((m) => ({ ...m, [short.id]: `min ${short.min_per_order} per order.` }));
      return setError(`${short.name}: min ${short.min_per_order} per order.`);
    }
    const emailProblem = emailError(form.email);
    const phoneProblem = phoneError(form.phone, form.sms_opt_in);
    setEmailMsg(emailProblem);
    setPhoneMsg(phoneProblem);
    if (emailProblem || phoneProblem) {
      document.getElementById(emailProblem ? "checkout-email" : "checkout-phone")?.focus();
      return;
    }
    setBusy(true);
    try {
      await loadHelcim();
      const { data, error } = await supabase.functions.invoke("create-checkout", { body: { drop_id: drop.id, ...form, email: form.email.trim(), items: lines } });
      if (error) { setError(await errText(error)); setBusy(false); load(); return; }
      const { order_id, checkoutToken } = data;
      let finished = false;
      const onMsg = async (ev: MessageEvent) => {
        if (ev.data?.eventName !== `helcim-pay-js-${checkoutToken}`) return;
        if (ev.data.eventStatus === "SUCCESS" && !finished) {
          finished = true;
          window.removeEventListener("message", onMsg);
          window.removeHelcimPayIframe?.();
          const { data: cData, error: cErr } = await supabase.functions.invoke("confirm-order", {
            body: { order_id, action: "confirm", event_message: ev.data.eventMessage },
          });
          if (cErr) setError(await errText(cErr));
          else {
            const cartLines = items.filter((i) => (qty[i.id] ?? 0) > 0).map((i) => ({ name: i.name, qty: qty[i.id], price_cents: i.price_cents }));
            setConfirmation(cData?.confirmation ?? {
              customer_name: discountPct ? form.customer_name.replace(/\([^()]*\)/g, " ").replace(/\s+/g, " ").trim() : form.customer_name,
              items: cartLines, total_cents: payTotal, subtotal_cents: total, discount_percent: discountPct,
              sms_opt_in: form.sms_opt_in, has_phone: !!form.phone, pickup: drop, pickup_address: null,
            });
            setOrderRef({ order_id, checkout_token: checkoutToken });
            setQty({});
            window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
          }
          setBusy(false); load();
        } else if ((ev.data.eventStatus === "ABORTED" || ev.data.eventStatus === "HIDE") && !finished) {
          finished = true;
          window.removeEventListener("message", onMsg);
          window.removeHelcimPayIframe?.();
          await supabase.functions.invoke("confirm-order", { body: { order_id, action: "cancel" } });
          if (ev.data.eventStatus === "ABORTED") setError("Payment didn't go through. Please try again.");
          setBusy(false); load();
        }
      };
      window.addEventListener("message", onMsg);
      window.appendHelcimPayIframe?.(checkoutToken, true);
    } catch {
      setError("Couldn't open the payment window. Please try again.");
      setBusy(false);
    }
  };

  const input = "w-full rounded-[6px] border border-primary/15 bg-background px-4 py-3 font-mono text-[15px] text-primary placeholder:text-primary/40 focus:outline-none focus:border-primary/50";

  if (confirmation) return <OrderConfirmation c={confirmation} orderRef={orderRef} menu={items} reduceMotion={!!reduceMotion} />;

  if (isSupabaseConfigured && (!loaded || phase === "upcoming")) return (
    <section id="order" className="relative pb-[60px] pt-10 md:pb-[108px] md:pt-14">
      <div className="mx-auto flex min-h-[45vh] max-w-[640px] flex-col items-center justify-center px-6 text-center md:px-10">
        {loaded && (
          <>
            <h2 className="font-display text-4xl font-black tracking-brand text-primary md:text-6xl">next drop coming soon.</h2>
            <p className="mt-4 font-mono text-[17px] text-primary/75">new menus are posted on instagram first.</p>
            <a href="https://www.instagram.com/aflakygood/" target="_blank" rel="noopener noreferrer"
              className="mt-8 rounded-[6px] bg-primary px-6 py-3.5 font-mono text-[16px] lowercase tracking-brand text-primary-foreground transition-colors hover:bg-[hsl(var(--green-deep))]">
              follow @aflakygood
            </a>
          </>
        )}
      </div>
    </section>
  );

  return (
    <section id="order" className="relative pb-[60px] pt-10 md:pb-[108px] md:pt-14">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <div className="flex flex-col items-center text-center">
          <h2 className="font-display text-4xl font-black tracking-brand text-primary md:text-6xl">this week's drop.</h2>
        </div>

        <motion.article
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-10 max-w-[760px] md:mt-14"
        >
          <div>
            <div className="mt-6 rounded-[6px] bg-secondary p-5 md:p-6">
              <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[11px] lowercase tracking-brand",
                open ? "bg-primary text-primary-foreground" : "bg-background/90 text-primary")}>
                <span className={cn("rounded-full", open ? "h-2 w-2 animate-pulse bg-primary-foreground" : "h-1.5 w-1.5 bg-primary opacity-40")} />
                <span>
                  {open ? "preorders open" : soldOut ? "sold out" : "preorders closed"}
                  {open && drop?.closes_at && <> · preorder closes on <span className="font-semibold">{closesLabel(drop.closes_at)}</span></>}
                </span>
              </span>
              {!isSupabaseConfigured ? (
                <p className="mt-4 font-mono text-[15px] leading-relaxed text-primary/80">preorders are coming soon.</p>
              ) : drop && (
                <ul className="mt-4 space-y-2 font-mono text-[15px] text-primary">
                  <li className="flex items-start gap-3">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{pickupWhen(drop)}</span>
                  </li>
                  {drop.pickup_location && (
                    <li className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{drop.pickup_location}</span>
                    </li>
                  )}
                </ul>
              )}
            </div>
            <div className="pt-2">
              {!isSupabaseConfigured ? null : (
                <form onSubmit={checkout} className="mt-6 space-y-6">
                  <ul className="grid grid-cols-2 gap-4 md:gap-6">
                    {items.map((i) => (
                      <li key={i.id} className="group">
                         <div className="relative aspect-[4/5] overflow-hidden rounded-[6px] bg-secondary/60">
                           <Button type="button" variant="ghost" onClick={() => openItem(i)} className="flex h-full w-full items-center justify-center overflow-hidden rounded-none p-0 hover:bg-transparent" aria-label={`view ${i.name}`}>
                          <img src={itemImage(i.name, i.image_url).src} alt={i.name} loading="lazy"
                             className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                           </Button>
                           {i.remaining === 0 ? (
                             <span className="absolute bottom-2 right-2 z-10 flex h-11 items-center rounded-full bg-primary px-4 font-mono text-[12px] lowercase text-primary-foreground">
                               sold out
                             </span>
                           ) : (
                           <motion.div
                             initial={false}
                             animate={{ width: (qty[i.id] ?? 0) > 0 ? 136 : 44 }}
                             transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 30 }}
                             className="absolute bottom-2 right-2 z-10 flex h-11 max-w-[calc(100%-16px)] items-center overflow-hidden rounded-full bg-primary text-primary-foreground"
                           >
                             {(qty[i.id] ?? 0) > 0 && (
                               <>
                                 <Button type="button" variant="ghost" size="icon"
                                   aria-label={`less ${i.name}`} onClick={() => change(i, -1)} disabled={!open}
                                   className="h-11 w-10 shrink-0 rounded-full text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground">
                                   {(qty[i.id] === 1 || belowMin(i, qty[i.id] - 1)) ? <Trash2 /> : <Minus />}
                                 </Button>
                                 <span className="min-w-0 flex-1 text-center font-mono text-[14px]" aria-live="polite" aria-atomic="true">
                                   <motion.span key={qty[i.id]} initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="block">
                                     {qty[i.id]}
                                     {i.min_per_order > 1 && qty[i.id] === i.min_per_order && <span className="ml-1 text-[12px] opacity-75">(min)</span>}
                                   </motion.span>
                                 </span>
                               </>
                             )}
                             <Button type="button" variant="ghost" size="icon"
                               aria-label={`more ${i.name}`} onClick={() => change(i, 1)} disabled={!open}
                               className="ml-auto h-11 w-11 shrink-0 rounded-full text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground">
                               <Plus className="!h-5 !w-5" />
                             </Button>
                           </motion.div>
                           )}
                        </div>
                         <Button type="button" variant="ghost" onClick={() => openItem(i)} className="block h-auto w-full whitespace-normal rounded-none p-0 text-left hover:bg-transparent" aria-label={`details ${i.name}`}>
                        <h3 className="mt-[18px] font-display text-base font-black leading-none tracking-brand text-primary md:text-lg md:leading-none">{i.name.toLowerCase()}.</h3>
                        <p className="mt-1 font-mono text-[12px] text-primary/65 md:text-[13px]">
                          {money(i.price_cents)}
                        </p>
                         </Button>
                        {limitMsg[i.id] && <p className="mt-2 font-mono text-[11px] text-destructive">{limitMsg[i.id]}</p>}
                      </li>
                    ))}
                  </ul>

                  {open && (
                    <div className="space-y-3 pt-5">
                      <input required maxLength={100} placeholder="name (required)" className={input} value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
                      <div>
                        <input id="checkout-email" type="text" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} placeholder="email (required)"
                          aria-invalid={!!emailMsg} aria-describedby={emailMsg ? "checkout-email-error" : undefined}
                          className={cn(input, emailMsg && "border-destructive focus:border-destructive")} value={form.email}
                          onChange={(e) => {
                            setForm({ ...form, email: e.target.value });
                            if (emailMsg) setEmailMsg(emailError(e.target.value));
                          }}
                          onBlur={() => form.email && setEmailMsg(emailError(form.email))} />
                        {emailMsg && <p id="checkout-email-error" role="alert" className="mt-1.5 font-mono text-[12px] normal-case text-destructive">{emailMsg}</p>}
                      </div>
                      <div>
                        <input id="checkout-phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="phone number"
                          aria-invalid={!!phoneMsg} aria-describedby={phoneMsg ? "checkout-phone-error" : undefined}
                          className={cn(input, phoneMsg && "border-destructive focus:border-destructive")} value={form.phone}
                          onChange={(e) => {
                            const { digits: phone, notice } = cleanPhone(e.target.value, form.phone);
                            setForm({ ...form, phone });
                            setPhoneMsg(notice || (phoneMsg ? phoneError(phone, form.sms_opt_in) : ""));
                          }}
                          onBlur={() => form.phone && setPhoneMsg(phoneError(form.phone))} />
                        {phoneMsg && <p id="checkout-phone-error" role="alert" className="mt-1.5 font-mono text-[12px] normal-case text-destructive">{phoneMsg}</p>}
                      </div>
                      <div className="pt-1">
                        <label htmlFor="checkout-sms-opt-in" className="flex cursor-pointer items-center gap-3 font-mono text-[15px] text-primary">
                          <Checkbox id="checkout-sms-opt-in" checked={form.sms_opt_in}
                            onCheckedChange={(v) => {
                              setForm({ ...form, sms_opt_in: v === true });
                              if (!form.phone) setPhoneMsg(v === true ? phoneError("", true) : "");
                            }}
                            aria-describedby="checkout-sms-terms"
                            className="h-5 w-5 rounded-[4px]" />
                          receive order and pickup updates on phone
                        </label>
                        <SmsDisclosure id="checkout-sms-terms" className="mt-1 pl-8" />
                      </div>
                    </div>
                  )}

                  {error && <p className="font-mono text-[12px] text-destructive">{error}</p>}

                  <div>
                    {discountPct && total > 0 ? (
                      <div role="status" className="relative mb-3 rounded-[6px] bg-secondary px-4 py-2.5 text-center font-mono text-[14px] text-primary">
                        your <span className="font-bold">{discountPct}% discount</span> is applied.
                        <span aria-hidden="true" className="absolute left-1/2 top-full -translate-x-1/2 border-x-[7px] border-t-[7px] border-x-transparent border-t-secondary" />
                      </div>
                    ) : null}
                    <button type="submit" disabled={!open || busy || total === 0}
                      className="flex w-full items-center justify-between rounded-[6px] bg-primary px-5 py-4 font-mono text-[16px] lowercase tracking-brand text-primary-foreground transition-colors hover:bg-[hsl(var(--green-deep))] disabled:opacity-50">
                      <span>{busy ? "opening payment…" : open ? "checkout" : soldOut ? "sold out" : "preorders closed"}</span>
                      <span className="flex items-baseline gap-2">
                        {discountPct && total > 0 ? <s className="opacity-60" aria-label={`was ${money(total)}`}>{money(total)}</s> : null}
                        <span>{money(payTotal)}</span>
                      </span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </motion.article>
      </div>
      {sel && (
        <div role="dialog" aria-modal="true" aria-label={sel.name} className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-background">
          <button type="button" aria-label="close" onClick={closeItem}
            className="fixed right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-primary/70 text-primary-foreground backdrop-blur-sm">
            <X className="h-4 w-4" />
          </button>
          <div className="mx-auto w-full max-w-[760px]">
            <img src={itemImage(sel.name, sel.image_url).src} alt={sel.name}
              className="aspect-[4/5] max-h-[70vh] w-full object-cover" />
            <div className="px-6 py-8">
              <h3 className="font-display text-2xl font-black tracking-brand text-primary">{sel.name.toLowerCase()}.</h3>
              <p className="mt-2 font-mono text-[13px] text-primary/70">{money(sel.price_cents)}</p>
              {sel.description && <p className="mt-5 whitespace-pre-line font-mono text-[13px] leading-relaxed text-primary/80">{sel.description}</p>}
              {sel.ingredients?.trim() && (
                <div className="mt-6">
                  <h4 className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary/60">ingredients</h4>
                  <p className="mt-2 whitespace-pre-line font-mono text-[13px] leading-relaxed text-primary/80">{sel.ingredients.trim()}</p>
                </div>
              )}
              {avail(sel) === 0 ? (
                <p className="mt-10 text-center font-mono text-[13px] text-primary/70">
                  {sel.remaining === 0 ? "sold out." : "no more available this week."}
                </p>
              ) : (
                <>
                  <div className="mt-10 flex items-center justify-center gap-5">
                    <button type="button" aria-label="less" onClick={() => mChange(-1)} disabled={mQty <= minFor(sel)}
                      className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-secondary text-primary disabled:opacity-40"><Minus className="h-5 w-5" /></button>
                    <span className="min-w-6 whitespace-nowrap text-center font-mono text-[15px] text-primary">
                      {mQty}
                      {sel.min_per_order > 1 && mQty === sel.min_per_order && <span className="ml-1 text-[13px] text-primary/60">(min)</span>}
                    </span>
                    <button type="button" aria-label="more" onClick={() => mChange(1)}
                      className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-secondary text-primary"><Plus className="h-5 w-5" /></button>
                  </div>
                  {mMsg && <p className="mt-3 text-center font-mono text-[11px] text-destructive">{mMsg}</p>}
                </>
              )}
            </div>
          </div>
          {avail(sel) > 0 && (
            <div className="sticky bottom-0 mt-auto w-full bg-background/95 px-4 pb-4 pt-2">
              <button type="button" disabled={!open}
                onClick={() => { setQty((q) => ({ ...q, [sel.id]: Math.min(mQty, avail(sel)) })); setLimitMsg((m) => ({ ...m, [sel.id]: "" })); closeItem(); }}
                className="mx-auto flex w-full max-w-[760px] items-center justify-between rounded-[6px] bg-primary px-6 py-4 font-mono text-[15px] lowercase tracking-brand text-primary-foreground transition-colors hover:bg-[hsl(var(--green-deep))] disabled:opacity-50">
                <span>{open ? "add to cart" : "preorders closed"}</span>
                <span>{money(sel.price_cents * mQty)}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function OrderConfirmation({ c, orderRef, menu, reduceMotion }: { c: Confirmation; orderRef: OrderRef | null; menu: Item[]; reduceMotion: boolean }) {
  const name = c.customer_name.trim();
  // Decided once so the checkbox stays put (and can be unticked) after opting in here.
  const [offerSms] = useState(!c.sms_opt_in && !!orderRef && c.has_phone !== false);
  const [smsOptIn, setSmsOptIn] = useState(c.sms_opt_in);
  const [smsError, setSmsError] = useState("");
  const updateSms = async (next: boolean) => {
    if (!orderRef) return;
    setSmsOptIn(next);
    setSmsError("");
    const { error } = await supabase.functions.invoke("confirm-order", {
      body: { ...orderRef, action: "sms_opt_in", sms_opt_in: next },
    });
    if (error) {
      setSmsOptIn(!next);
      setSmsError("couldn't save that, please try again.");
    }
  };
  const where = c.pickup_address ?? c.pickup?.pickup_location;
  const label = "font-display text-[20px] font-black tracking-brand text-primary";
  return (
    <section id="order" className="relative pb-[60px] pt-10 md:pb-[108px] md:pt-14">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-[640px] px-6 md:px-10"
      >
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mt-6 font-display text-4xl font-black tracking-brand text-primary md:text-6xl">
            you're in{name ? ` ${name}` : ""}.
          </h2>
          <p className="mt-3 font-mono text-[17px] text-primary/75">thank you for your order.</p>
          {c.email_sent && c.email && (
            <p className="mt-2 font-mono text-[13px] text-primary/60">
              a confirmation is on its way to <span className="normal-case">{c.email}</span>.
              <span className="mt-0.5 block">(check your spam folder)</span>
            </p>
          )}
        </div>

        <div className="mt-10 rounded-[6px] bg-secondary p-5 md:mt-12 md:p-6">
          <p className={label}>pickup details</p>
          <ul className="mt-4 space-y-2 font-mono text-[15px] text-primary">
            {c.pickup && (
              <li className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{pickupWhen(c.pickup)}</span>
              </li>
            )}
            {where && (
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className={c.pickup_address ? "normal-case" : undefined}>{where}</span>
              </li>
            )}
          </ul>
        </div>

        {offerSms && (
          <div className="mt-5 px-1">
            <label htmlFor="confirm-sms-opt-in" className="flex cursor-pointer items-center gap-3 font-mono text-[15px] text-primary">
              <Checkbox id="confirm-sms-opt-in" checked={smsOptIn}
                onCheckedChange={(v) => updateSms(v === true)}
                aria-describedby="confirm-sms-terms"
                className="h-5 w-5 rounded-[4px]" />
              receive order and pickup updates on phone
            </label>
            <SmsDisclosure id="confirm-sms-terms" className="mt-1 pl-8" />
            {smsError && <p role="alert" className="mt-1.5 pl-8 font-mono text-[12px] text-destructive">{smsError}</p>}
          </div>
        )}

        <div className="mt-5 rounded-[6px] border border-primary/15 p-5 md:p-6">
          <p className={label}>your order</p>
          <ul className="mt-4 divide-y divide-primary/10">
            {c.items.map((i) => {
              const img = itemImage(i.name, menu.find((m) => m.name === i.name)?.image_url);
              return (
                <li key={i.name} className="flex items-center gap-4 py-3 first:pt-0">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-secondary">
                    <img src={img.src} alt="" loading="lazy"
                      className="h-full w-full object-cover" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[17px] font-black tracking-brand text-primary">{i.name}</p>
                    <p className="font-mono text-[13px] text-primary/60">{i.qty} × {money(i.price_cents)}</p>
                  </div>
                  <span className="font-mono text-[15px] text-primary">{money(i.qty * i.price_cents)}</span>
                </li>
              );
            })}
          </ul>
          {c.discount_percent && c.subtotal_cents ? (
            <div className="mt-2 space-y-1 border-t border-primary/15 pt-4 font-mono text-[15px] text-primary/75">
              <div className="flex justify-between"><span>subtotal</span><span>{money(c.subtotal_cents)}</span></div>
              <div className="flex justify-between"><span>{c.discount_percent}% discount</span><span>−{money(c.subtotal_cents - c.total_cents)}</span></div>
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-between border-t border-primary/15 pt-4 font-display text-xl font-black tracking-brand text-primary">
            <span>total</span>
            <span>{money(c.total_cents)}</span>
          </div>
        </div>

        <div className="mt-10 text-center">
          <a href="/" className="font-mono text-[15px] text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">
            back to home
          </a>
        </div>
      </motion.div>
    </section>
  );
}
