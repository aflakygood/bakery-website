import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

type Order = { id: string; customer_name: string; email: string; phone: string; items: { name: string; qty: number }[]; total_cents: number; status: string; created_at: string };
type Item = { id: string; name: string; price_cents: number; total_qty: number; max_per_order: number };
type Drop = { id: string; title: string; pickup_info: string; is_open: boolean };

export default function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = async () => {
    const { data: latestDrop } = await supabase.from("drops").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
    setDrop(latestDrop);
    if (!latestDrop) return;
    const { data: dropItems } = await supabase.from("drop_items").select("*").eq("drop_id", latestDrop.id).order("sort");
    setItems((dropItems ?? []) as Item[]);
    const { data: paidOrders } = await supabase.from("orders").select("*").eq("drop_id", latestDrop.id).in("status", ["paid", "picked_up"]).order("created_at");
    setOrders((paidOrders ?? []) as Order[]);
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

  const saveDrop = async (patch: Partial<Drop>) => {
    if (!drop) return;
    await supabase.from("drops").update(patch).eq("id", drop.id);
    void load();
  };
  const saveItem = async (id: string, patch: Partial<Item>) => {
    await supabase.from("drop_items").update(patch).eq("id", id);
    void load();
  };
  const markPicked = async (id: string) => {
    await supabase.from("orders").update({ status: "picked_up" }).eq("id", id);
    void load();
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
              <h2 className="font-display text-2xl font-black tracking-brand text-primary">this drop.</h2>
              <button onClick={() => void saveDrop({ is_open: !drop.is_open })} className="rounded-sm bg-primary px-4 py-2 font-mono text-[12px] text-primary-foreground">
                {drop.is_open ? "close preorders" : "open preorders"}
              </button>
            </div>
            <label className="mt-4 block font-mono text-[11px] text-primary/60">pickup details shown to customers</label>
            <input className={field} defaultValue={drop.pickup_info} onBlur={(event) => event.target.value !== drop.pickup_info && void saveDrop({ pickup_info: event.target.value })} />
            <div className="mt-5 overflow-x-auto">
              <table className="w-full font-mono text-[12px] text-primary">
                <thead className="text-left text-primary/60"><tr><th className="py-2">item</th><th>price $</th><th>total spots</th><th>max / order</th><th>sold</th></tr></thead>
                <tbody>
                  {tally.map((item) => (
                    <tr key={item.id} className="border-t border-primary/10">
                      <td className="py-2 pr-2">{item.name}</td>
                      <td className="pr-2"><input type="number" min={0} step="0.5" className={`${field} w-20`} defaultValue={item.price_cents / 100} onBlur={(event) => void saveItem(item.id, { price_cents: Math.round(Number(event.target.value) * 100) })} /></td>
                      <td className="pr-2"><input type="number" min={0} className={`${field} w-20`} defaultValue={item.total_qty} onBlur={(event) => void saveItem(item.id, { total_qty: Number(event.target.value) })} /></td>
                      <td className="pr-2"><input type="number" min={1} className={`${field} w-20`} defaultValue={item.max_per_order} onBlur={(event) => void saveItem(item.id, { max_per_order: Number(event.target.value) })} /></td>
                      <td>{item.sold} / {item.total_qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className={box}>
          <h2 className="font-display text-2xl font-black tracking-brand text-primary">paid orders ({orders.length}).</h2>
          {orders.length === 0 && <p className="mt-3 font-mono text-[13px] text-primary/60">no orders yet.</p>}
          <ul className="mt-3 divide-y divide-primary/10">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-start justify-between gap-3 py-3 font-mono text-[12px] text-primary">
                <div>
                  <p className="font-bold">{order.customer_name} · ${(order.total_cents / 100).toFixed(2)}</p>
                  <p className="text-primary/70">{order.email}{order.phone && ` · ${order.phone}`}</p>
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
