import { describe, expect, it, vi } from "vitest";
import { discountCents, findDiscount } from "../../supabase/functions/_shared/discount";

const names = ["shail", "urmi", "dayana", "sheenu", "sowjanya", "sasi"];
const discounts = [
  ...names.map((code) => ({ code, percent: 10, active: true, match_name: true })),
  { code: "friends", percent: 10, active: true, match_name: false },
  { code: "nintynine", percent: 99, active: true, match_name: false },
  { code: "inactive", percent: 10, active: false, match_name: true },
];

function database(error: Error | null = null) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn(async (_column: string, codes: string[]) => ({
      data: error ? null : discounts.filter((d) => d.active && codes.includes(d.code)),
      error,
    })),
  };
  return { from: vi.fn(() => query), query };
}

describe("name discounts", () => {
  it.each(names)("applies 10%% for %s regardless of capitalization", async (name) => {
    for (const variant of [name, name.toUpperCase(), name[0].toUpperCase() + name.slice(1), `  ${name}  `]) {
      const db = database();
      expect(await findDiscount(db, variant)).toEqual({
        code: name, percent: 10, cleanName: variant.trim(),
      });
      expect(db.query.eq).toHaveBeenCalledWith("active", true);
    }
  });

  it("accepts mixed capitalization", async () => {
    expect(await findDiscount(database(), "sHaIl")).toEqual({
      code: "shail", percent: 10, cleanName: "sHaIl",
    });
  });

  it.each(["Shail Patel", "Shaila", "Sas", "unknown", "inactive", "friends", "nintynine"])(
    "does not discount an unmatched name or bracket-only code: %s", async (name) => {
      expect(await findDiscount(database(), name)).toBeNull();
    },
  );

  it("does not query for an empty name", async () => {
    const db = database();
    expect(await findDiscount(db, "   ")).toBeNull();
    expect(db.from).not.toHaveBeenCalled();
  });

  it.each(["friends", "nintynine", ...names])("preserves parenthesized code %s", async (code) => {
    const result = await findDiscount(database(), `Ayush ( ${code.toUpperCase()} )`);
    expect(result).toEqual({
      code, percent: code === "nintynine" ? 99 : 10, cleanName: "Ayush",
    });
  });

  it("preserves unrelated parentheses and the first matching code's priority", async () => {
    expect(await findDiscount(database(), "Ayush (pickup) (FRIENDS) (nintynine)")).toEqual({
      code: "friends", percent: 10, cleanName: "Ayush (pickup) (nintynine)",
    });
  });

  it("surfaces lookup errors rather than silently omitting a discount", async () => {
    const error = new Error("Discount lookup failed");
    await expect(findDiscount(database(error), "Shail")).rejects.toThrow(error);
  });

  it.each([[1000, 100], [999, 100], [105, 11], [0, 0]])(
    "takes 10%% off %i cents with the existing rounding", (subtotal, discount) => {
      expect(discountCents(subtotal, 10)).toBe(discount);
      expect(subtotal - discountCents(subtotal, 10)).toBe(subtotal - discount);
    },
  );
});
