import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { discountCents, findDiscount } from "../_shared/discount.ts";
import { EMAIL_RE, US_PHONE_RE } from "../_shared/contact.ts";

const Body = z.object({
  drop_id: z.string().uuid(),
  customer_name: z.string().trim().min(1).max(100),
  email: z.string().trim().max(254).regex(EMAIL_RE),
  phone: z.union([z.literal(""), z.string().trim().regex(US_PHONE_RE)]).optional().default(""),
  sms_opt_in: z.boolean().optional().default(false),
  items: z.array(z.object({ item_id: z.string().uuid(), qty: z.number().int().min(1).max(50) })).min(1).max(20),
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      const message = field === "email" ? "Enter a valid email address (e.g. name@example.com)."
        : field === "phone" ? "Enter a valid 10-digit US phone number, numbers only (e.g. 4255550123)."
        : "Please check your details and try again.";
      return json({ error: message }, 400);
    }
    const input = parsed.data;
    if (input.sms_opt_in && !input.phone) return json({ error: "Enter phone number to receive order and pickup updates." }, 400);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: drop } = await db.from("drops").select("*").eq("id", input.drop_id).maybeSingle();
    const now = Date.now();
    const live = !!drop && drop.is_open && !!drop.opens_at && Date.parse(drop.opens_at) <= now
      && (!drop.closes_at || Date.parse(drop.closes_at) > now);
    if (!live) return json({ error: "Preorders are closed for this drop." }, 400);

    // Merge repeated lines so per-order limits and stock checks can't be bypassed.
    const wanted = new Map<string, number>();
    for (const { item_id, qty } of input.items) wanted.set(item_id, (wanted.get(item_id) ?? 0) + qty);

    const { data: dbItems } = await db.from("drop_items").select("*").eq("drop_id", drop.id);
    const { data: groups } = await db.from("item_groups").select("id, name").eq("drop_id", drop.id);
    const lines: { item_id: string; name: string; qty: number; price_cents: number }[] = [];
    // Items in a group share its spots, so the combined quantity per group must fit too.
    const groupWanted = new Map<string, { qty: number; remaining: number }>();
    const remainingOf = new Map<string, number>();
    let total = 0;
    for (const [item_id, qty] of wanted) {
      const it = dbItems?.find((d) => d.id === item_id);
      if (!it) return json({ error: "An item is no longer available." }, 400);
      if (qty > it.max_per_order) return json({ error: `Max ${it.max_per_order} ${it.name} per order.` }, 400);
      const { data: remaining } = await db.rpc("item_remaining", { _item_id: item_id });
      if ((remaining ?? 0) < qty) return json({ error: `Only ${Math.max(0, remaining ?? 0)} ${it.name} left.` }, 409);
      remainingOf.set(item_id, remaining ?? 0);
      if (it.group_id) {
        const g = groupWanted.get(it.group_id) ?? { qty: 0, remaining: remaining ?? 0 };
        groupWanted.set(it.group_id, { ...g, qty: g.qty + qty });
      }
      lines.push({ item_id, name: it.name, qty, price_cents: it.price_cents });
      total += qty * it.price_cents;
    }
    for (const [group_id, g] of groupWanted) {
      if (g.qty > g.remaining) {
        const name = groups?.find((x) => x.id === group_id)?.name ?? "that item";
        return json({ error: `Only ${Math.max(0, g.remaining)} ${name} left in total.` }, 409);
      }
    }
    // Below the minimum is fine only when it takes everything left (after other items sharing the group).
    for (const line of lines) {
      const it = dbItems!.find((d) => d.id === line.item_id)!;
      const min = it.min_per_order ?? 1;
      if (line.qty >= min) continue;
      const g = it.group_id ? groupWanted.get(it.group_id) : undefined;
      const available = g ? g.remaining - (g.qty - line.qty) : remainingOf.get(line.item_id) ?? 0;
      if (line.qty < available) return json({ error: `Min ${min} ${it.name} per order.` }, 400);
    }

    const subtotal = total;
    const discount = await findDiscount(db, input.customer_name);
    if (discount) total = subtotal - discountCents(subtotal, discount.percent);
    const customerName = discount?.cleanName || input.customer_name;

    const { data: order, error: oErr } = await db.from("orders").insert({
      drop_id: drop.id, customer_name: customerName, email: input.email, phone: input.phone, sms_opt_in: input.sms_opt_in,
      items: lines, total_cents: total, subtotal_cents: subtotal, status: "pending",
      discount_code: discount?.code ?? null, discount_percent: discount?.percent ?? null,
    }).select("id").single();
    if (oErr) throw oErr;

    const res = await fetch("https://api.helcim.com/v2/helcim-pay/initialize", {
      method: "POST",
      headers: { "api-token": Deno.env.get("HELCIM_API_TOKEN")!, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ paymentType: "purchase", amount: total / 100, currency: "USD" }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`Helcim initialize failed [${res.status}]: ${text}`);
      await db.from("orders").update({ status: "failed" }).eq("id", order.id);
      return json({ error: "Payment couldn't start. Please try again.", details: text }, 502);
    }
    const { checkoutToken, secretToken } = JSON.parse(text);
    await db.from("orders").update({ checkout_token: checkoutToken, secret_token: secretToken }).eq("id", order.id);
    return json({ order_id: order.id, checkoutToken });
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
