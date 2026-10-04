import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const Body = z.object({
  drop_id: z.string().uuid(),
  customer_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).default(""),
  items: z.array(z.object({ item_id: z.string().uuid(), qty: z.number().int().min(1).max(50) })).min(1).max(20),
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Please check your details and try again." }, 400);
    const input = parsed.data;
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: drop } = await db.from("drops").select("*").eq("id", input.drop_id).maybeSingle();
    if (!drop || !drop.is_open) return json({ error: "Pre-orders are closed for this drop." }, 400);

    const { data: dbItems } = await db.from("drop_items").select("*").eq("drop_id", drop.id);
    const lines: { item_id: string; name: string; qty: number; price_cents: number }[] = [];
    let total = 0;
    for (const { item_id, qty } of input.items) {
      const it = dbItems?.find((d) => d.id === item_id);
      if (!it) return json({ error: "An item is no longer available." }, 400);
      if (qty > it.max_per_order) return json({ error: `Max ${it.max_per_order} ${it.name} per order.` }, 400);
      const { data: remaining } = await db.rpc("item_remaining", { _item_id: item_id });
      if ((remaining ?? 0) < qty) return json({ error: `Only ${Math.max(0, remaining ?? 0)} ${it.name} left.` }, 409);
      lines.push({ item_id, name: it.name, qty, price_cents: it.price_cents });
      total += qty * it.price_cents;
    }

    const { data: order, error: oErr } = await db.from("orders").insert({
      drop_id: drop.id, customer_name: input.customer_name, email: input.email, phone: input.phone,
      items: lines, total_cents: total, status: "pending",
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
