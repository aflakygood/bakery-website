# Ordering backend setup

The website's `/admin` page and checkout form use the Supabase project configured in `supabase/config.toml`.

1. Apply the SQL migrations in `drizzle/migrations/` to that project, in filename order.
2. In Supabase Authentication, enable the Google provider and configure its Google OAuth client. In Google Cloud, add `https://tgixzvlzoqqtnchejpvo.supabase.co/auth/v1/callback` as an authorized redirect URI. Add the deployed site's `/admin` URL to Supabase's allowed redirect URLs.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Render static-site environment. Use the same values locally in a non-committed `.env` file.
4. Deploy `create-checkout` and `confirm-order` as Supabase Edge Functions, and set the `HELCIM_API_TOKEN` Edge Function secret before opening pre-orders.
5. In Render's Redirects/Rewrites settings, add a `/*` → `/index.html` **Rewrite** so direct visits to `/admin` load the React app.

The owner role migration grants admin access only to `aflakygood@gmail.com` after that account signs in with Google.

## Name-based discounts

Apply `drizzle/migrations/0013_name_discounts.sql`, then redeploy both
`check-discount` and `create-checkout` and publish the updated frontend.
The migration adds six active 10% discounts: Shail, Urmi, Dayana, Sheenu,
Sowjanya, and Sasi. The entire checkout name must match, ignoring capitalization
and leading/trailing spaces (for example, `sHaIl` qualifies, but `Shail Patel`
does not). The customer's name is preserved on the order.

Existing parenthesized codes, such as `Ayush (friends)`, still work.
Only codes with `match_name = true` can also match a name without parentheses.
Discounts are validated and calculated server-side during checkout.
