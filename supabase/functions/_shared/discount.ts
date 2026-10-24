// Matches parenthesized codes or an entire customer name for codes with match_name enabled.
// Codes live in the server-only discount_codes table and are matched case-insensitively.
// deno-lint-ignore no-explicit-any
export async function findDiscount(db: any, name: string) {
  const bracketCodes = [...name.matchAll(/\(([^()]{1,40})\)/g)].map((m) => m[1].trim().toLowerCase()).filter(Boolean).slice(0, 5);
  const normalizedName = name.trim().toLowerCase();
  const candidates = [...new Set([...bracketCodes, normalizedName].filter(Boolean))];
  if (!candidates.length) return null;
  const { data, error } = await db.from("discount_codes").select("code, percent, match_name").eq("active", true).in("code", candidates);
  if (error) throw error;
  type Discount = { code: string; percent: number; match_name: boolean };
  const hit = candidates.map((c) => data?.find((d: Discount) =>
    d.code === c && (bracketCodes.includes(c) || (d.match_name && c === normalizedName))
  )).find(Boolean) as Discount | undefined;
  if (!hit) return null;
  const cleanName = name.replace(/\(([^()]{1,40})\)/g, (all, inner) => (inner.trim().toLowerCase() === hit.code ? " " : all)).replace(/\s+/g, " ").trim();
  return { code: hit.code, percent: hit.percent, cleanName };
}

export const discountCents = (subtotal: number, percent: number) => Math.round((subtotal * percent) / 100);
