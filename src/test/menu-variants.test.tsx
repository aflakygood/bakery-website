import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OrderMenu from "@/components/OrderMenu";
import { lineKey, lowestPrice, parseVariants } from "@/lib/variants";

const db = vi.hoisted(() => ({ remaining: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: db.remaining,
    functions: { invoke: async () => ({ data: null }) },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: {
          id: "drop", title: "this week", is_open: true,
          opens_at: "2020-01-01T00:00:00Z", closes_at: null,
          pickup_date: null, pickup_start: null, pickup_end: null, pickup_location: "",
        } }),
        then: (resolve: (value: object) => unknown) => Promise.resolve({
          error: null,
          data: [
            {
              id: "focaccia", name: "olive focaccia", description: "", ingredients: "", price_cents: 800,
              variants: [{ id: "mini", label: "mini", price_cents: 800 }, { id: "full", label: '8"x8"', price_cents: 2400 }],
              min_per_order: 1, max_per_order: 3, image_url: null, group_id: null,
            },
            {
              id: "bread", name: "sourdough", description: "", ingredients: "", price_cents: 1200,
              min_per_order: 1, max_per_order: 2, image_url: null, group_id: null,
            },
          ],
        }).then(resolve),
      };
      return query;
    },
  },
}));

beforeEach(() => {
  const Observer = class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  };
  vi.stubGlobal("IntersectionObserver", Observer);
  vi.stubGlobal("ResizeObserver", Observer);
  db.remaining.mockReset().mockResolvedValue({ data: 10 });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const checkoutTotal = () => screen.getByRole("button", { name: /checkout/, hidden: true });

describe("item variations on the menu", () => {
  it("shows a 'from' price and opens the variation sheet instead of adding directly", async () => {
    render(<OrderMenu />);
    const plus = await screen.findByRole("button", { name: "choose options for olive focaccia" });
    expect(screen.getByRole("button", { name: "details olive focaccia" })).toHaveTextContent("from $8");
    expect(screen.getByRole("button", { name: "details sourdough" })).toHaveTextContent("$12");
    fireEvent.click(plus);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("mini")).toBeInTheDocument();
    expect(within(dialog).getByText('8"x8"')).toBeInTheDocument();
    expect(within(dialog).getByText("$8")).toBeInTheDocument();
    expect(within(dialog).getByText("$24")).toBeInTheDocument();
    expect(checkoutTotal()).toHaveTextContent("$0");
  });

  it("prices each variation separately and updates the cart", async () => {
    render(<OrderMenu />);
    fireEvent.click(await screen.findByRole("button", { name: "choose options for olive focaccia" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /add to cart/ })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "more mini" }));
    fireEvent.click(within(dialog).getByRole("button", { name: 'more 8"x8"' }));
    expect(within(dialog).getByRole("button", { name: /add to cart/ })).toHaveTextContent("$32");
    fireEvent.click(within(dialog).getByRole("button", { name: /add to cart/ }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(checkoutTotal()).toHaveTextContent("$32");
    const edit = screen.getByRole("button", { name: "edit options for olive focaccia, 2 in cart" });
    expect(edit).toHaveTextContent("2");
    expect(screen.queryByRole("button", { name: "choose options for olive focaccia" })).not.toBeInTheDocument();

    fireEvent.click(edit);
    const again = await screen.findByRole("dialog");
    fireEvent.click(within(again).getByRole("button", { name: 'less 8"x8"' }));
    fireEvent.click(within(again).getByRole("button", { name: /update cart/ }));
    await vi.waitFor(() => expect(checkoutTotal()).toHaveTextContent("$8"));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("limits the combined quantity of all variations to the item's max per order", async () => {
    render(<OrderMenu />);
    fireEvent.click(await screen.findByRole("button", { name: "choose options for olive focaccia" }));
    const dialog = await screen.findByRole("dialog");
    for (let n = 0; n < 3; n++) fireEvent.click(within(dialog).getByRole("button", { name: "more mini" }));
    fireEvent.click(within(dialog).getByRole("button", { name: 'more 8"x8"' }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("that's the most you can order.");
    expect(within(dialog).getByRole("button", { name: /add to cart/ })).toHaveTextContent("$24");
  });

  it("still adds items without variations directly", async () => {
    render(<OrderMenu />);
    fireEvent.click(await screen.findByRole("button", { name: "more sourdough" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(checkoutTotal()).toHaveTextContent("$12");
  });
});

describe("variant helpers", () => {
  it("drops malformed variations and tolerates missing data", () => {
    expect(parseVariants(undefined)).toEqual([]);
    expect(parseVariants("nope")).toEqual([]);
    expect(parseVariants([
      { id: "a", label: " mini ", price_cents: 800 },
      { id: "", label: "no id", price_cents: 100 },
      { id: "b", label: "", price_cents: 100 },
      { id: "c", label: "bad price", price_cents: 1.5 },
      null,
    ])).toEqual([{ id: "a", label: "mini", price_cents: 800 }]);
  });

  it("uses the lowest variation price and keys lines by item and variation", () => {
    expect(lowestPrice(5000, [{ id: "a", label: "x", price_cents: 2400 }, { id: "b", label: "y", price_cents: 800 }])).toBe(800);
    expect(lowestPrice(1200, [])).toBe(1200);
    expect(lineKey("item", "mini")).toBe("item:mini");
    expect(lineKey("item")).toBe("item");
  });
});
