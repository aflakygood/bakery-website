import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

// A placeholder keeps the public site renderable until its deployment variables are set.
// No requests are made against it when isSupabaseConfigured is false.
export const supabase = createClient(
  supabaseUrl ?? "https://supabase-unconfigured.invalid",
  supabasePublishableKey ?? "supabase-unconfigured",
);
