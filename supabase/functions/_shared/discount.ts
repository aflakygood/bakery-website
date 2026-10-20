// Finds a secret discount code typed in brackets in the customer's name, e.g. "Ayush (friends)".
// Codes live in the server-only discount_codes table and are matched case-insensitively.
// deno-lint-ignore no-explicit-any
export async function findDiscount(db: any, name: string) {
  const candidates = [...name.matchAll(/\(([^()]{1,40})\)/g)].map((m) => m[1].trim().toLowerCase()).filter(Boolean).slice(0, 5);
  if (!candidates.length) return null;
  const { data } = await db.from("discount_codes").select("code, percent").eq("active", true).in("code", candidates);
  const hit = candidates.map((c) => data?.find((d: { code: string }) => d.code === c)).find(Boolean) as { code: string; percent: number } | undefined;
  if (!hit) return null;
  const cleanName = name.replace(/\(([^()]{1,40})\)/g, (all, inner) => (inner.trim().toLowerCase() === hit.code ? " " : all)).replace(/\s+/g, " ").trim();
  return { code: hit.code, percent: hit.percent, cleanName };
}

export const discountCents = (subtotal: number, percent: number) => Math.round((subtotal * percent) / 100);
