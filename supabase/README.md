# Ordering backend setup

The website's `/admin` page and checkout form use the Supabase project configured in `supabase/config.toml`.

1. Apply the SQL migrations in `drizzle/migrations/` to that project, in filename order.
2. In Supabase Authentication, enable the Google provider and configure its Google OAuth client. In Google Cloud, add `https://ngkpqibhjpsydnnxamsu.supabase.co/auth/v1/callback` as an authorized redirect URI. Add the deployed site's `/admin` URL to Supabase's allowed redirect URLs.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Render static-site environment. Use the same values locally in a non-committed `.env` file.
4. Deploy `create-checkout` and `confirm-order` as Supabase Edge Functions, and set the `HELCIM_API_TOKEN` Edge Function secret before opening pre-orders.
5. In Render's Redirects/Rewrites settings, add a `/*` → `/index.html` **Rewrite** so direct visits to `/admin` load the React app.

The owner role migration grants admin access only to `aflakygood@gmail.com` after that account signs in with Google.
