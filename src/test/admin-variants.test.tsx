import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Admin from "@/pages/Admin";

const db = vi.hoisted(() => ({ items: [] as Record<string, unknown>[], saves: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      getSession: async () => ({ data: { session: { user: { id: "owner" } } } }),
    },
    rpc: async () => ({ data: true }),
    from: (table: string) => {
      let patch: Record<string, unknown> | null = null;
      let id: unknown;
      const result = () => {
        if (table === "drops") return { data: {
          id: "drop", title: "this week", is_open: true, opens_at: null, closes_at: null,
          pickup_date: null, pickup_start: null, pickup_end: null, pickup_location: "",
        }, error: null };
        if (table === "item_groups" || table === "orders") return { data: [], error: null };
        return { data: db.items.map((item) => ({ ...item })), error: null };
      };
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((column: string, value: unknown) => { if (column === "id") id = value; return query; }),
        in: vi.fn(() => query),
        limit: vi.fn(() => query),
        order: vi.fn(() => query),
        then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
        maybeSingle: vi.fn(async () => result()),
        update: vi.fn((values: Record<string, unknown>) => { patch = values; return query; }),
        single: vi.fn(async () => {
          db.saves(table, id, patch);
          db.items = db.items.map((item) => item.id === id ? { ...item, ...patch } : item);
          return { data: { id }, error: null };
        }),
      };
      return query;
    },
  },
}));

beforeEach(() => {
  db.items = [{
    id: "focaccia", name: "olive focaccia", description: "", ingredients: "", price_cents: 800, variants: [],
    total_qty: 10, min_per_order: 1, max_per_order: 3, sort: 1, image_url: null, group_id: null, archived: false,
  }];
  db.saves.mockClear();
});
afterEach(cleanup);

describe("admin item variations", () => {
  it("adds variations with their own prices and saves them with the lowest as the item price", async () => {
    render(<Admin />);
    fireEvent.click(await screen.findByRole("button", { name: "add variation to olive focaccia" }));
    fireEvent.click(screen.getByRole("button", { name: "add variation to olive focaccia" }));
    fireEvent.change(screen.getByLabelText("variation 1 name for olive focaccia"), { target: { value: "mini" } });
    fireEvent.change(screen.getByLabelText("variation 1 price for olive focaccia"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("variation 2 name for olive focaccia"), { target: { value: '8"x8"' } });
    fireEvent.change(screen.getByLabelText("variation 2 price for olive focaccia"), { target: { value: "24" } });
    fireEvent.click(screen.getByRole("button", { name: "save changes" }));
    await waitFor(() => expect(db.saves).toHaveBeenCalled());
    const [, , patch] = db.saves.mock.calls[0];
    expect(patch.price_cents).toBe(800);
    expect(patch.variants).toEqual([
      { id: expect.any(String), label: "mini", price_cents: 800 },
      { id: expect.any(String), label: '8"x8"', price_cents: 2400 },
    ]);
  });

  it("rejects a variation without a name or with a duplicate name", async () => {
    render(<Admin />);
    fireEvent.click(await screen.findByRole("button", { name: "add variation to olive focaccia" }));
    fireEvent.change(screen.getByLabelText("variation 1 price for olive focaccia"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "save changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent("every variation of olive focaccia needs a name.");
    fireEvent.change(screen.getByLabelText("variation 1 name for olive focaccia"), { target: { value: "mini" } });
    fireEvent.click(screen.getByRole("button", { name: "add variation to olive focaccia" }));
    fireEvent.change(screen.getByLabelText("variation 2 name for olive focaccia"), { target: { value: "Mini" } });
    fireEvent.change(screen.getByLabelText("variation 2 price for olive focaccia"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "save changes" }));
    expect(await screen.findByText("olive focaccia has two variations called Mini.")).toBeInTheDocument();
    expect(db.saves).not.toHaveBeenCalled();
  });

  it("removes variations so the item goes back to its single price", async () => {
    db.items[0].variants = [{ id: "a", label: "mini", price_cents: 800 }];
    render(<Admin />);
    fireEvent.click(await screen.findByRole("button", { name: "remove variation mini from olive focaccia" }));
    expect(screen.queryByLabelText("variation 1 name for olive focaccia")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "save changes" }));
    await waitFor(() => expect(db.saves).toHaveBeenCalled());
    expect(db.saves.mock.calls[0][2]).toMatchObject({ price_cents: 800, variants: [] });
  });
});
