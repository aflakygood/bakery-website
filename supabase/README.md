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

## Deleting menu items

Apply `drizzle/migrations/0014_archive_menu_items.sql` before publishing the
updated frontend, then redeploy `create-checkout`.

In `/admin`, choose **delete item**, confirm, then **save changes**.
**Discard** restores the item before saving. Unsaved new items can be removed
without confirmation. Saved items are archived: they disappear from the menu,
cannot be used in new checkouts, and are not copied when starting the next drop.
Existing orders, product images, and shared-stock reservations are preserved.
Admin sold counts still include archived items in their stock group.
Deletion uses the existing database `has_role` admin policy; no new grants are
needed. `item_remaining` deliberately continues to include archived group members.

To check authorization, retained reservations/history, and next-drop copying,
run `psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/archive-menu-items.sql`
against a migrated test database with permission to `SET ROLE authenticated`.
The test rolls back its fixtures and changes.

## Item variations

Apply `drizzle/migrations/0015_item_variants.sql` before publishing the updated
frontend, then redeploy `create-checkout`.

In `/admin`, choose **+ add variation** on any item and enter a label and price
for each option (up to 12). On the menu, "+" on that item opens a picker (modal
on desktop, bottom sheet on phones) instead of adding directly. The item shows
"from $lowest"; its own price field is ignored while it has variations. Prices
are always resolved server-side by `create-checkout`. Variations are copied to
the next drop.

`drizzle/migrations/0016_seed_item_variants.sql` (apply after 0015) gives existing
cookie items a "3 piece pack" $8.99 / "6 piece pack" $15.99 choice and focaccia
items a "mini" $8 / "8"x8"" $24 choice, and drops the "(3p)" / "(8"x8")" suffix
from their names. It skips items that already have variations.

All variations of an item share that item's spots (and stock group), one spot
per unit, and the per-order min/max apply to the combined quantity. Order lines
are named "item name — variation label".
