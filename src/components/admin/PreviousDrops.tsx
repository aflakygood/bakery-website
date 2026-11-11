import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { pastDropTitle } from "@/lib/drop";
import { itemImage } from "@/lib/itemImage";
import { lowestPrice, money as menuPrice, parseVariants } from "@/lib/variants";

type PastDrop = { id: string; title: string; pickup_date: string | null; created_at: string };
type PastItem = { id: string; drop_id: string; name: string; price_cents: number; variants?: unknown; total_qty: number; sort: number; image_url: string | null };
type PastOrder = {
  id: string; drop_id: string; customer_name: string; email: string; phone: string; sms_opt_in: boolean;
  items: { item_id?: string; name: string; qty: number }[]; total_cents: number; discount_code: string | null; discount_percent: number | null;
  status: string; is_test: boolean;
};

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function PreviousDrops({ currentDropId }: { currentDropId: string | null }) {
  const [drops, setDrops] = useState<PastDrop[] | null>(null);
  const [orders, setOrders] = useState<PastOrder[]>([]);
  const [menu, setMenu] = useState<PastItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: allDrops, error: dropsError } = await supabase.from("drops").select("*").order("created_at", { ascending: false });
      if (cancelled) return;
      if (dropsError) return setError(dropsError.message);
      const past = ((allDrops ?? []) as PastDrop[]).filter((d) => d.id !== currentDropId);
      if (past.length) {
        const { data: paid, error: ordersError } = await supabase.from("orders").select("*")
          .in("drop_id", past.map((d) => d.id)).in("status", ["paid", "picked_up"]).order("created_at");
        if (cancelled) return;
        if (ordersError) return setError(ordersError.message);
        setOrders((paid ?? []) as unknown as PastOrder[]);
        // Includes archived items: they were on that drop's menu.
        const { data: menuItems, error: menuError } = await supabase.from("drop_items").select("*").in("drop_id", past.map((d) => d.id)).order("sort");
        if (cancelled) return;
        if (menuError) return setError(menuError.message);
        setMenu((menuItems ?? []) as PastItem[]);
      }
      setDrops(past);
    })();
    return () => { cancelled = true; };
  }, [currentDropId]);

  if (error) return <p role="alert" className="font-mono text-[13px] text-destructive">couldn't load previous drops: {error}</p>;
  if (!drops) return <p className="font-mono text-[13px] text-primary/60">loading…</p>;
  if (!drops.length) return <p className="font-mono text-[13px] text-primary/60">no previous drops yet. a drop shows up here after you start the next one.</p>;

  return (
    <ul className="space-y-3">
      {drops.map((drop) => {
        const dropOrders = orders.filter((o) => o.drop_id === drop.id);
        const real = dropOrders.filter((o) => !o.is_test);
        const revenue = real.reduce((sum, o) => sum + o.total_cents, 0);
        const dropMenu = menu.filter((i) => i.drop_id === drop.id);
        const soldOf = (item: PastItem) => real.reduce((n, o) => n + o.items
          .filter((line) => (line.item_id ? line.item_id === item.id : line.name === item.name))
          .reduce((m, line) => m + line.qty, 0), 0);
        const open = openId === drop.id;
        const title = pastDropTitle(drop);
        return (
          <li key={drop.id} className="rounded-md bg-secondary p-5 md:p-6">
            <button onClick={() => setOpenId(open ? null : drop.id)} aria-expanded={open}
              className="flex w-full flex-wrap items-start justify-between gap-2 text-left">
              <span>
                <span className="block font-display text-xl font-black tracking-brand text-primary">{title}</span>
                <span className="block font-mono text-[12px] text-primary/70">{dropOrders.length} paid {dropOrders.length === 1 ? "order" : "orders"} · {money(revenue)}</span>
              </span>
              <span className="font-mono text-[12px] text-primary underline">{open ? "hide orders" : "view orders"}</span>
            </button>
            {open && (
              <div className="mt-4">
                <p className="font-mono text-[11px] text-primary/60">menu</p>
                {dropMenu.length === 0 && <p className="font-mono text-[13px] text-primary/60">no menu items saved for this drop.</p>}
                <ul className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {dropMenu.map((item) => (
                    <li key={item.id}>
                      <img src={itemImage(item.name, item.image_url).src} alt={item.name} loading="lazy" className="aspect-[4/5] w-full rounded-sm bg-background object-cover" />
                      <p className="mt-1 font-mono text-[12px] font-bold text-primary">{item.name}</p>
                      <p className="font-mono text-[11px] text-primary/70">
                        {parseVariants(item.variants).length ? "from " : ""}{menuPrice(lowestPrice(item.price_cents, parseVariants(item.variants)))} · sold {soldOf(item)}
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 font-mono text-[11px] text-primary/60">orders</p>
                {dropOrders.length === 0 && <p className="font-mono text-[13px] text-primary/60">no paid orders for this drop.</p>}
                <ul className="mt-2 divide-y divide-primary/10">
                  {dropOrders.map((order) => (
                    <li key={order.id} className="flex flex-wrap items-start justify-between gap-3 py-3 font-mono text-[12px] text-primary">
                      <div>
                        <p className="font-bold">
                          {order.is_test && <span className="mr-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-normal">test</span>}
                          {order.customer_name} · {money(order.total_cents)}{order.discount_percent ? ` (${order.discount_percent}% off · ${order.discount_code})` : ""}
                        </p>
                        <p className="text-primary/70"><span className="normal-case">{[order.email, order.phone].filter(Boolean).join(" · ")}</span>{order.sms_opt_in ? " · opted in to phone updates" : ""}</p>
                        <p className="text-primary/70">{order.items.map((line) => `${line.qty}× ${line.name}`).join(", ")}</p>
                      </div>
                      <span className="text-primary/50">{order.status === "picked_up" ? "picked up" : "not picked up"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
