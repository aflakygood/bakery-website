// Item variations (e.g. mini / 8"x8"), stored as jsonb on drop_items.variants.
// Shared with the edge functions so checkout prices lines exactly like the menu shows them.
export type Variant = { id: string; label: string; price_cents: number };

export const MAX_VARIANTS = 12;

// Tolerates missing or malformed data (older rows, hand-edited JSON) by dropping bad entries.
export function parseVariants(raw: unknown): Variant[] {
  if (!Array.isArray(raw)) return [];
  const out: Variant[] = [];
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const { id, label, price_cents } = v as Record<string, unknown>;
    if (typeof id !== "string" || !id || typeof label !== "string" || !label.trim()) continue;
    if (typeof price_cents !== "number" || !Number.isInteger(price_cents) || price_cents < 0) continue;
    out.push({ id, label: label.trim(), price_cents });
  }
  return out;
}

// Cart/line key: plain item id, or item id + variation id when the item has variations.
export const lineKey = (itemId: string, variantId?: string | null) => (variantId ? `${itemId}:${variantId}` : itemId);

export const lineName = (itemName: string, variantLabel: string) => `${itemName} — ${variantLabel}`;

export const lowestPrice = (basePriceCents: number, variants: Variant[]) =>
  variants.length ? Math.min(...variants.map((v) => v.price_cents)) : basePriceCents;
