import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OrderMenu from "@/components/OrderMenu";

const db = vi.hoisted(() => ({ filters: vi.fn(), error: false, remaining: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: db.remaining,
    from: (table: string) => {
      let activeOnly = false;
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          db.filters(table, column, value);
          if (column === "archived" && value === false) activeOnly = true;
          return query;
        },
        order: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: {
          id: "drop", title: "this week", is_open: true,
          opens_at: "2020-01-01T00:00:00Z", closes_at: null,
          pickup_date: null, pickup_start: null, pickup_end: null, pickup_location: "",
        } }),
        then: (resolve: (value: object) => unknown) => {
          const items = [
            { id: "bread", name: "sourdough", archived: true },
            { id: "seeds", name: "multigrain", archived: false },
          ].map((item) => ({
            ...item, description: "", ingredients: "", price_cents: 1200,
            min_per_order: 1, max_per_order: 2, image_url: null, group_id: null,
          }));
          return Promise.resolve({
            data: db.error ? null : items.filter((item) => !activeOnly || !item.archived),
            error: db.error ? { message: "column archived does not exist" } : null,
          }).then(resolve);
        },
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
  db.filters.mockClear();
  db.error = false;
  db.remaining.mockReset().mockResolvedValue({ data: 4 });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("archived public menu items", () => {
  it("queries only active items and does not offer archived items or fetch their stock", async () => {
    render(<OrderMenu />);
    expect(await screen.findByRole("button", { name: "view multigrain" })).toBeInTheDocument();
    expect(db.filters).toHaveBeenCalledWith("drop_items", "archived", false);
    expect(screen.queryByRole("button", { name: "view sourdough" })).not.toBeInTheDocument();
    expect(db.remaining).toHaveBeenCalledExactlyOnceWith("item_remaining", { _item_id: "seeds" });
  });

  it("surfaces menu load errors instead of showing an empty or upcoming menu", async () => {
    db.error = true;
    render(<OrderMenu />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the menu. Please refresh and try again.");
    expect(screen.queryByText("next drop coming soon.")).not.toBeInTheDocument();
    expect(db.remaining).not.toHaveBeenCalled();
  });
});
