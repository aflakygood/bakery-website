export * from "../../supabase/functions/_shared/variants.ts";

export const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
