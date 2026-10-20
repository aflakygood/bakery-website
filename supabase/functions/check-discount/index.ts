import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { findDiscount } from "../_shared/discount.ts";

const Body = z.object({ name: z.string().max(100) });

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Only reveals the percent for a matching code; never lists codes.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ percent: null });
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const hit = await findDiscount(db, parsed.data.name);
    return json({ percent: hit?.percent ?? null });
  } catch (e) {
    console.error(e);
    return json({ percent: null });
  }
});
