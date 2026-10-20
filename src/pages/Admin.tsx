import { Fragment, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { pickupWhen, type PickupFields } from "@/lib/pickup";
import { dropPhase, useNow, type DropSchedule } from "@/lib/drop";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Order = { id: string; customer_name: string; email: string; phone: string; sms_opt_in: boolean; items: { name: string; qty: number }[]; total_cents: number; discount_code: string | null; discount_percent: number | null; status: string; created_at: string };
type Item = { id: string; name: string; description: string; price_cents: number; total_qty: number; max_per_order: number };
type Drop = PickupFields & DropSchedule & { id: string; title: string };

// <input type="datetime-local"> works in the admin's local time; the database stores UTC.
const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);
const phaseLabel = { upcoming: "not live yet", open: "taking preorders", ended: "ended (shows sold out)", closed: "closed early" } as const;

type DropDraft = { opens_at: string; closes_at: string; pickup_date: string; pickup_start: string; pickup_end: string; pickup_location: string };
type ItemDraft = { price: string; total_qty: string; max_per_order: string; description: string };
const dropDraftOf = (d: Drop): DropDraft => ({
  opens_at: toLocalInput(d.opens_at),
  closes_at: toLocalInput(d.closes_at),
  pickup_date: d.pickup_date ?? "",
  pickup_start: d.pickup_start?.slice(0, 5) ?? "",
  pickup_end: d.pickup_end?.slice(0, 5) ?? "",
  pickup_location: d.pickup_location ?? "",
});
const itemDraftOf = (i: Item): ItemDraft => ({
  price: String(i.price_cents / 100),
  total_qty: String(i.total_qty),
  max_per_order: String(i.max_per_order),
  description: i.description ?? "",
});
const same = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

export default function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [dropDraft, setDropDraft] = useState<DropDraft | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, ItemDraft>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState<"close" | "next" | null>(null);
  const now = useNow();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  // resetDrafts=false keeps unsaved edits (e.g. after marking an order picked up).
  const load = async (resetDrafts = true) => {
    const { data: latestDrop } = await supabase.from("drops").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
    setDrop(latestDrop);
    if (resetDrafts) setDropDraft(latestDrop ? dropDraftOf(latestDrop) : null);
    if (!latestDrop) return;
    const { data: dropItems } = await supabase.from("drop_items").select("*").eq("drop_id", latestDrop.id).order("sort");
    setItems((dropItems ?? []) as Item[]);
    if (resetDrafts) setItemDrafts(Object.fromEntries(((dropItems ?? []) as Item[]).map((item) => [item.id, itemDraftOf(item)])));
    const { data: paidOrders } = await supabase.from("orders").select("*").eq("drop_id", latestDrop.id).in("status", ["paid", "picked_up"]).order("created_at");
    setOrders((paidOrders ?? []) as unknown as Order[]);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (!session) return setIsAdmin(null);
    supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(!!data);
      if (data) void load();
    });
  }, [session]);

  const signIn = () => supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/admin` },
  });

  const dirty = !!drop && !!dropDraft && (!same(dropDraft, dropDraftOf(drop)) || items.some((item) => itemDrafts[item.id] && !same(itemDrafts[item.id], itemDraftOf(item))));

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const editDrop = (patch: Partial<DropDraft>) => { setNotice(null); setDropDraft((d) => (d ? { ...d, ...patch } : d)); };
  const editItem = (id: string, patch: Partial<ItemDraft>) => { setNotice(null); setItemDrafts((all) => ({ ...all, [id]: { ...all[id], ...patch } })); };

  const save = async () => {
    if (!drop || !dropDraft) return;
    const base = dropDraftOf(drop);
    const dropPatch: Record<string, string | null> = {};
    if (dropDraft.opens_at !== base.opens_at) dropPatch.opens_at = fromLocalInput(dropDraft.opens_at);
    if (dropDraft.closes_at !== base.closes_at) dropPatch.closes_at = fromLocalInput(dropDraft.closes_at);
    if (dropDraft.pickup_date !== base.pickup_date) dropPatch.pickup_date = dropDraft.pickup_date || null;
    if (dropDraft.pickup_start !== base.pickup_start) dropPatch.pickup_start = dropDraft.pickup_start || null;
    if (dropDraft.pickup_end !== base.pickup_end) dropPatch.pickup_end = dropDraft.pickup_end || null;
    if (dropDraft.pickup_location !== base.pickup_location) dropPatch.pickup_location = dropDraft.pickup_location;
    if (dropDraft.opens_at && dropDraft.closes_at && dropDraft.closes_at <= dropDraft.opens_at)
      return setNotice({ ok: false, text: "closes must be after opens." });

    const itemPatches: { id: string; patch: Partial<Item> }[] = [];
    for (const item of items) {
      const draft = itemDrafts[item.id];
      if (!draft || same(draft, itemDraftOf(item))) continue;
      const price = Number(draft.price), qty = Number(draft.total_qty), max = Number(draft.max_per_order);
      if (draft.price === "" || !Number.isFinite(price) || price < 0) return setNotice({ ok: false, text: `check the price for ${item.name}.` });
      if (draft.total_qty === "" || !Number.isInteger(qty) || qty < 0) return setNotice({ ok: false, text: `total spots for ${item.name} must be a whole number.` });
      if (!Number.isInteger(max) || max < 1) return setNotice({ ok: false, text: `max / order for ${item.name} must be at least 1.` });
      itemPatches.push({ id: item.id, patch: { price_cents: Math.round(price * 100), total_qty: qty, max_per_order: max, description: draft.description } });
    }

    setSaving(true);
    const results = await Promise.all([
      ...(Object.keys(dropPatch).length ? [supabase.from("drops").update(dropPatch).eq("id", drop.id)] : []),
      ...itemPatches.map(({ id, patch }) => supabase.from("drop_items").update(patch).eq("id", id)),
    ]);
    setSaving(false);
    const failed = results.find((result) => result.error);
    setNotice(failed ? { ok: false, text: `couldn't save: ${failed.error?.message}` } : { ok: true, text: "saved." });
    await load(!failed);
  };
  const discard = () => {
    if (!drop) return;
    setNotice(null);
    setDropDraft(dropDraftOf(drop));
    setItemDrafts(Object.fromEntries(items.map((item) => [item.id, itemDraftOf(item)])));
  };
  const setOpen = async (isOpen: boolean) => {
    if (!drop) return;
    const { error } = await supabase.from("drops").update({ is_open: isOpen }).eq("id", drop.id);
    setNotice(error ? { ok: false, text: `couldn't update: ${error.message}` } : { ok: true, text: isOpen ? "preorders reopened." : "preorders closed." });
    await load(false);
  };
  const startNextDrop = async () => {
    const { error } = await supabase.rpc("start_next_drop");
    if (error) return setNotice({ ok: false, text: `couldn't start the next drop: ${error.message}` });
    setNotice({ ok: true, text: "next drop started. set the quantities and open time, then save." });
    await load(true);
  };
  const markPicked = async (id: string) => {
    await supabase.from("orders").update({ status: "picked_up" }).eq("id", id);
    void load(false);
  };
  const confirmCopy = {
    close: { title: "close preorders now?", body: "customers won't be able to order from this drop until you reopen it.", action: "close now", run: () => setOpen(false) },
    next: {
      title: "start the next drop?",
      body: `this ends the current drop now. the new drop copies the items and prices with 0 quantity, and stays hidden until you set its open time.${dirty ? " your unsaved changes will be discarded." : ""}`,
      action: "start next drop",
      run: startNextDrop,
    },
  };

  const box = "rounded-md bg-secondary p-5 md:p-6";
  const field = "w-full rounded-sm border border-primary/15 bg-background px-3 py-2 font-mono text-[13px] text-primary";

  if (!isSupabaseConfigured) return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center font-mono text-[13px] text-primary">
      <p>admin setup is incomplete. Add the Supabase environment values before signing in.</p>
    </div>
  );

  if (!session) return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className={`${box} max-w-sm text-center`}>
        <h1 className="font-display text-3xl font-black tracking-brand text-primary">owner sign in.</h1>
        <button onClick={() => void signIn()} className="mt-6 w-full rounded-sm bg-primary px-5 py-3 font-mono text-[12px] text-primary-foreground">
          sign in with Google
        </button>
      </div>
    </div>
  );

  if (isAdmin === false) return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center font-mono text-[13px] text-primary">
      <div>
        <p>this account ({session.user.email}) doesn't have owner access yet.</p>
        <button className="mt-4 underline" onClick={() => void supabase.auth.signOut()}>sign out</button>
      </div>
    </div>
  );

  const tally = items.map((item) => ({ ...item, sold: orders.reduce((sum, order) => sum + (order.items.find((line) => line.name === item.name)?.qty ?? 0), 0) }));

  return (
    <div className="min-h-screen bg-background px-5 py-10 md:px-10">
      <div className="mx-auto max-w-[1000px] space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-4xl font-black tracking-brand text-primary">orders.</h1>
          <button className="font-mono text-[12px] text-primary underline" onClick={() => void supabase.auth.signOut()}>sign out</button>
        </div>

        {drop && (
          <section className={box}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-black tracking-brand text-primary">this drop.</h2>
                <p className="font-mono text-[12px] text-primary/70">status: {phaseLabel[dropPhase(drop, now)]}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => (drop.is_open ? setConfirming("close") : void setOpen(true))} className="rounded-sm border border-primary px-4 py-2 font-mono text-[12px] text-primary">
                  {drop.is_open ? "close now" : "reopen"}
                </button>
                <button onClick={() => setConfirming("next")} className="rounded-sm bg-primary px-4 py-2 font-mono text-[12px] text-primary-foreground">
                  start next drop
                </button>
              </div>
            </div>
            {dropDraft && (<>
              <p className="mt-4 font-mono text-[11px] text-primary/60">preorder window (your local time). the drop is hidden before it opens and shows sold out after it closes.</p>
              <div className="mt-1 grid gap-3 sm:grid-cols-2">
                <label className="font-mono text-[11px] text-primary/60">opens
                  <input type="datetime-local" className={field} value={dropDraft.opens_at} onChange={(event) => editDrop({ opens_at: event.target.value })} />
                </label>
                <label className="font-mono text-[11px] text-primary/60">closes
                  <input type="datetime-local" className={field} value={dropDraft.closes_at} onChange={(event) => editDrop({ closes_at: event.target.value })} />
                </label>
              </div>
              <p className="mt-4 font-mono text-[11px] text-primary/60">pickup details shown to customers</p>
              <div className="mt-1 grid gap-3 sm:grid-cols-3">
                <label className="font-mono text-[11px] text-primary/60">date
                  <input type="date" className={field} value={dropDraft.pickup_date} onChange={(event) => editDrop({ pickup_date: event.target.value })} />
                </label>
                <label className="font-mono text-[11px] text-primary/60">start
                  <input type="time" className={field} value={dropDraft.pickup_start} onChange={(event) => editDrop({ pickup_start: event.target.value })} />
                </label>
                <label className="font-mono text-[11px] text-primary/60">end
                  <input type="time" className={field} value={dropDraft.pickup_end} onChange={(event) => editDrop({ pickup_end: event.target.value })} />
                </label>
              </div>
              <label className="mt-3 block font-mono text-[11px] text-primary/60">location
                <input className={field} value={dropDraft.pickup_location} onChange={(event) => editDrop({ pickup_location: event.target.value })} />
              </label>
              <p className="mt-2 font-mono text-[12px] text-primary/70">
                preview: {pickupWhen({ ...drop, pickup_date: dropDraft.pickup_date || null, pickup_start: dropDraft.pickup_start || null, pickup_end: dropDraft.pickup_end || null })}
                {dropDraft.pickup_location ? ` · ${dropDraft.pickup_location}` : ""}
              </p>
            </>)}
            <div className="mt-5 overflow-x-auto">
              <table className="w-full font-mono text-[12px] text-primary">
                <thead className="text-left text-primary/60"><tr><th className="py-2">item</th><th>price $</th><th>total spots</th><th>max / order</th><th>sold</th></tr></thead>
                <tbody>
                  {tally.map((item) => {
                    const draft = itemDrafts[item.id] ?? itemDraftOf(item);
                    return (<Fragment key={item.id}>
                      <tr className="border-t border-primary/10">
                        <td className="py-2 pr-2">{item.name}</td>
                        <td className="pr-2"><input type="number" min={0} step="0.5" className={`${field} w-20`} value={draft.price} onChange={(event) => editItem(item.id, { price: event.target.value })} /></td>
                        <td className="pr-2"><input type="number" min={0} className={`${field} w-20`} value={draft.total_qty} onChange={(event) => editItem(item.id, { total_qty: event.target.value })} /></td>
                        <td className="pr-2"><input type="number" min={1} className={`${field} w-20`} value={draft.max_per_order} onChange={(event) => editItem(item.id, { max_per_order: event.target.value })} /></td>
                        <td>{item.sold} / {item.total_qty}</td>
                      </tr>
                      <tr><td colSpan={5} className="pb-3">
                        <textarea rows={3} placeholder="description shown to customers" className={field} value={draft.description} onChange={(event) => editItem(item.id, { description: event.target.value })} />
                      </td></tr>
                    </Fragment>);
                  })}
                </tbody>
              </table>
            </div>
            <div className="sticky bottom-4 mt-4 flex flex-wrap items-center justify-end gap-3 rounded-md bg-secondary/95 py-2 backdrop-blur">
              {notice ? (
                <p role="status" className={`mr-auto font-mono text-[12px] ${notice.ok ? "text-primary/70" : "text-destructive"}`}>{notice.text}</p>
              ) : dirty && <p className="mr-auto font-mono text-[12px] text-primary/70">unsaved changes</p>}
              {dirty && <button onClick={discard} disabled={saving} className="font-mono text-[12px] text-primary underline disabled:opacity-50">discard</button>}
              <button onClick={() => void save()} disabled={!dirty || saving} className="rounded-sm bg-primary px-5 py-2 font-mono text-[12px] text-primary-foreground disabled:opacity-40">
                {saving ? "saving…" : "save changes"}
              </button>
            </div>
          </section>
        )}

        <AlertDialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
          {confirming && (
            <AlertDialogContent className="w-[calc(100%-2.5rem)] max-w-sm rounded-md border-primary/15 bg-background sm:rounded-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display text-2xl font-black tracking-brand text-primary">{confirmCopy[confirming].title}</AlertDialogTitle>
                <AlertDialogDescription className="font-mono text-[12px] text-primary/70">{confirmCopy[confirming].body}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="rounded-sm border-primary font-mono text-[12px] text-primary">cancel</AlertDialogCancel>
                <AlertDialogAction className="rounded-sm font-mono text-[12px]" onClick={() => void confirmCopy[confirming].run()}>{confirmCopy[confirming].action}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          )}
        </AlertDialog>

        <section className={box}>
          <h2 className="font-display text-2xl font-black tracking-brand text-primary">paid orders ({orders.length}).</h2>
          {orders.length === 0 && <p className="mt-3 font-mono text-[13px] text-primary/60">no orders yet.</p>}
          <ul className="mt-3 divide-y divide-primary/10">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-start justify-between gap-3 py-3 font-mono text-[12px] text-primary">
                <div>
                  <p className="font-bold">{order.customer_name} · ${(order.total_cents / 100).toFixed(2)}{order.discount_percent ? ` (${order.discount_percent}% off · ${order.discount_code})` : ""}</p>
                  <p className="text-primary/70">{order.phone || order.email}{order.sms_opt_in ? " · opted in to phone updates" : ""}</p>
                  <p className="text-primary/70">{order.items.map((line) => `${line.qty}× ${line.name}`).join(", ")}</p>
                </div>
                {order.status === "picked_up" ? <span className="text-primary/50">picked up</span> : <button onClick={() => void markPicked(order.id)} className="underline">mark picked up</button>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
