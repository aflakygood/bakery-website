import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const Body = z.object({
  order_id: z.string().uuid(),
  action: z.enum(["confirm", "cancel"]),
  event_message: z.unknown().optional(),
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid request" }, 400);
    const { order_id, action, event_message } = parsed.data;
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: order } = await db.from("orders").select("*").eq("id", order_id).maybeSingle();
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

    await db.from("orders").update({ status: "paid", transaction_id: String(payload.transactionId ?? "") }).eq("id", order_id);
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong" }, 500);
  }
});
