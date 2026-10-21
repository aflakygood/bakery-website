import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { sendOrderEmail } from "../_shared/email.ts";

const Body = z.object({
  order_id: z.string().uuid(),
  action: z.enum(["confirm", "cancel", "sms_opt_in"]),
  event_message: z.unknown().optional(),
  checkout_token: z.string().min(1).optional(),
  sms_opt_in: z.boolean().optional(),
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Only called after the payment hash is verified. The full pickup address lives in the
// server-only private_settings table and is never exposed anywhere else.
// deno-lint-ignore no-explicit-any
async function confirmationFor(db: any, order: any, sendEmail = false) {
  try {
    const [{ data: drop }, { data: address }] = await Promise.all([
      db.from("drops").select("pickup_info, pickup_date, pickup_start, pickup_end, pickup_location").eq("id", order.drop_id).maybeSingle(),
      db.from("private_settings").select("value").eq("key", "pickup_address").maybeSingle(),
    ]);
    const details = {
      customer_name: order.customer_name,
      items: (order.items ?? []).map((i: { name: string; qty: number; price_cents: number }) => ({ name: i.name, qty: i.qty, price_cents: i.price_cents })),
      total_cents: order.total_cents,
      subtotal_cents: order.subtotal_cents ?? order.total_cents,
      discount_percent: order.discount_percent ?? null,
      pickup: drop ?? null,
      pickup_address: address?.value ?? null,
    };
    const emailSent = sendEmail ? await sendOrderEmail(order.email, details) : false;
    return { ...details, sms_opt_in: !!order.sms_opt_in, has_phone: !!order.phone, email: order.email || null, email_sent: emailSent };
  } catch (e) {
    console.error("confirmation details failed", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid request" }, 400);
    const { order_id, action, event_message } = parsed.data;
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: order } = await db.from("orders").select("*").eq("id", order_id).maybeSingle();

    // Post-purchase SMS opt-in from the confirmation page. The checkout token is only known
    // to the browser that placed the order, so nobody can change someone else's preference.
    if (action === "sms_opt_in") {
      const { checkout_token, sms_opt_in } = parsed.data;
      if (!order || order.status !== "paid" || !order.phone || !checkout_token || checkout_token !== order.checkout_token || sms_opt_in === undefined) {
        return json({ error: "Order not found" }, 404);
      }
      await db.from("orders").update({ sms_opt_in }).eq("id", order_id);
      return json({ ok: true });
    }

    if (!order || order.status !== "pending") return json({ error: "Order not found" }, 404);

    if (action === "cancel") {
      await db.from("orders").update({ status: "cancelled" }).eq("id", order_id);
      return json({ ok: true });
    }

    // Helcim sends { data: { data: {...transaction}, hash } } — verify hash with the secret token
    const msg = typeof event_message === "string" ? JSON.parse(event_message) : event_message as any;
    const payload = msg?.data?.data ?? msg?.data;
    const hash = msg?.data?.hash ?? msg?.hash;
    if (!payload || !hash) return json({ error: "Missing payment data" }, 400);
    const expected = await sha256(JSON.stringify(payload) + order.secret_token);
    if (expected !== hash) return json({ error: "Payment could not be verified" }, 400);
    const approved = String(payload.status ?? "").toUpperCase() === "APPROVED";
    const paidAmount = Math.round(Number(payload.amount) * 100);
    if (!approved || paidAmount !== order.total_cents) return json({ error: "Payment not approved" }, 400);

    // Only the request that actually flips pending -> paid sends the email, so it never goes out twice.
    const { data: flipped } = await db.from("orders").update({ status: "paid", transaction_id: String(payload.transactionId ?? "") })
      .eq("id", order_id).eq("status", "pending").select("id");
    return json({ ok: true, confirmation: await confirmationFor(db, order, !!flipped?.length) });
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong" }, 500);
  }
});
