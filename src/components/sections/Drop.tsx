import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Minus, Plus, Check } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

type Item = { id: string; name: string; price_cents: number; max_per_order: number; remaining: number };
type DropRow = { id: string; title: string; pickup_info: string; is_open: boolean };

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

export default function Drop() {
  const [drop, setDrop] = useState<DropRow | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [form, setForm] = useState({ customer_name: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const load = async () => {
    if (!isSupabaseConfigured) return;
    const { data: d } = await supabase.from("drops").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!d) return;
    setDrop(d);
    const { data: its } = await supabase.from("drop_items").select("*").eq("drop_id", d.id).order("sort");
    const withRemaining = await Promise.all(
      (its ?? []).map(async (i) => {
        const { data: r } = await supabase.rpc("item_remaining", { _item_id: i.id });
        return { ...i, remaining: Math.max(0, r ?? 0) };
      }),
    );
    setItems(withRemaining);
  };
  useEffect(() => { load(); }, []);

  const soldOut = items.length > 0 && items.every((i) => i.remaining === 0);
  const open = !!drop?.is_open && !soldOut;
  const total = useMemo(() => items.reduce((s, i) => s + (qty[i.id] ?? 0) * i.price_cents, 0), [items, qty]);

  const change = (i: Item, d: number) =>
    setQty((q) => ({ ...q, [i.id]: Math.max(0, Math.min((q[i.id] ?? 0) + d, i.max_per_order, i.remaining)) }));

  const checkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drop) return;
    setError("");
    const lines = Object.entries(qty).filter(([, n]) => n > 0).map(([item_id, n]) => ({ item_id, qty: n }));
    if (!lines.length) return setError("Pick at least one item.");
    setBusy(true);
    try {
      await loadHelcim();
      const { data, error } = await supabase.functions.invoke("create-checkout", { body: { drop_id: drop.id, ...form, items: lines } });
      if (error) { setError(await errText(error)); setBusy(false); load(); return; }
      const { order_id, checkoutToken } = data;
      let finished = false;
      const onMsg = async (ev: MessageEvent) => {
        if (ev.data?.eventName !== `helcim-pay-js-${checkoutToken}`) return;
        if (ev.data.eventStatus === "SUCCESS" && !finished) {
          finished = true;
          window.removeEventListener("message", onMsg);
          window.removeHelcimPayIframe?.();
          const { error: cErr } = await supabase.functions.invoke("confirm-order", {
            body: { order_id, action: "confirm", event_message: ev.data.eventMessage },
          });
          if (cErr) setError(await errText(cErr)); else { setDone(true); setQty({}); }
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

  const input = "w-full rounded-sm border border-primary/15 bg-background px-4 py-3 font-mono text-[13px] text-primary placeholder:text-primary/40 focus:outline-none focus:border-primary/50";

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
          className="mt-10 overflow-hidden rounded-md bg-secondary md:mt-14"
        >
          <div className="grid md:grid-cols-2">
            <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[420px]">
              <img
                src="https://images.unsplash.com/photo-1568471173242-461f0a730452?w=1400&q=85&auto=format&fit=crop"
                alt="Featured drop — laminated pastry assortment"
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
              <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 font-mono text-[10px] lowercase tracking-brand text-primary backdrop-blur-sm">
                <span className={`h-1.5 w-1.5 rounded-full bg-primary ${open ? "animate-pulse" : "opacity-40"}`} />
                {open ? "preorders open" : soldOut ? "sold out" : "preorders closed"}
              </span>
            </div>

            <div className="p-6 md:p-10">
              {!isSupabaseConfigured ? (
                <p className="font-mono text-[13px] leading-relaxed text-primary/75">preorders are coming soon.</p>
              ) : drop && (
                <p className="flex items-center gap-2 font-mono text-[12px] text-primary/80">
                  <Calendar className="h-3.5 w-3.5" /> {drop.pickup_info}
                </p>
              )}

              {!isSupabaseConfigured ? null : done ? (
                <div className="mt-8 rounded-sm bg-background p-6 text-center">
                  <Check className="mx-auto h-6 w-6 text-primary" />
                  <h3 className="mt-3 font-display text-2xl font-black tracking-brand text-primary">you're in.</h3>
                  <p className="mt-2 font-mono text-[13px] text-primary/75">payment received. pickup details will follow by DM.</p>
                </div>
              ) : (
                <form onSubmit={checkout} className="mt-6 space-y-6">
                  <ul className="divide-y divide-primary/10">
                    {items.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-3 py-3">
                        <div>
                          <p className="font-display text-lg font-black tracking-brand text-primary">{i.name}.</p>
                          <p className="font-mono text-[11px] text-primary/60">
                            {money(i.price_cents)} · {i.remaining === 0 ? "sold out" : `${i.remaining} left · max ${i.max_per_order}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button type="button" aria-label={`less ${i.name}`} onClick={() => change(i, -1)} disabled={!open || !qty[i.id]}
                            className="rounded-full border border-primary/20 p-1.5 text-primary disabled:opacity-30"><Minus className="h-3 w-3" /></button>
                          <span className="w-4 text-center font-mono text-[13px] text-primary">{qty[i.id] ?? 0}</span>
                          <button type="button" aria-label={`more ${i.name}`} onClick={() => change(i, 1)}
                            disabled={!open || (qty[i.id] ?? 0) >= Math.min(i.max_per_order, i.remaining)}
                            className="rounded-full border border-primary/20 p-1.5 text-primary disabled:opacity-30"><Plus className="h-3 w-3" /></button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {open && (
                    <div className="space-y-3">
                      <input required maxLength={100} placeholder="name" className={input} value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
                      <input required type="email" maxLength={255} placeholder="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                      <input maxLength={30} placeholder="phone or instagram (optional)" className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </div>
                  )}

                  {error && <p className="font-mono text-[12px] text-destructive">{error}</p>}

                  <button type="submit" disabled={!open || busy || total === 0}
                    className="flex w-full items-center justify-between rounded-sm bg-primary px-5 py-4 font-mono text-[12px] lowercase tracking-brand text-primary-foreground transition-colors hover:bg-[hsl(var(--green-deep))] disabled:opacity-50">
                    <span>{busy ? "opening payment…" : open ? "checkout" : soldOut ? "sold out" : "preorders closed"}</span>
                    <span>{money(total)}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </motion.article>
      </div>
    </section>
  );
}
