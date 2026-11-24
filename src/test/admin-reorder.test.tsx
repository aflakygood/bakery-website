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
        return { data: db.items.map((item) => ({ ...item })).sort((a, b) => Number(a.sort) - Number(b.sort)), error: null };
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

const item = (id: string, sort: number) => ({
  id, name: id, description: "", ingredients: "", price_cents: 800, variants: [],
  total_qty: 10, min_per_order: 1, max_per_order: 3, sort, image_url: null, group_id: null, archived: false,
});

beforeEach(() => {
  db.items = [item("focaccia", 1), item("croissant", 2), item("danish", 3)];
  db.saves.mockClear();
});
afterEach(cleanup);

const names = () => screen.getAllByLabelText(/^description for /).map((el) => el.getAttribute("aria-label")?.replace("description for ", ""));

describe("admin menu reordering", () => {
  it("moves items up and down, disabling the buttons at either end", async () => {
    render(<Admin />);
    await screen.findByLabelText("description for focaccia");
    expect(screen.getByRole("button", { name: "move focaccia up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "move danish down" })).toBeDisabled();
    expect(screen.getByLabelText("position 3 of 3")).toHaveTextContent("3/3");
    fireEvent.click(screen.getByRole("button", { name: "move danish up" }));
    expect(screen.getByLabelText("position 2 of 3")).toHaveTextContent("2/3");
    expect(names()).toEqual(["focaccia", "danish", "croissant"]);
    expect(screen.getByText("unsaved changes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "move focaccia down" }));
    expect(names()).toEqual(["danish", "focaccia", "croissant"]);
  });

  it("saves only the items whose position changed", async () => {
    render(<Admin />);
    await screen.findByLabelText("description for focaccia");
    fireEvent.click(screen.getByRole("button", { name: "move croissant up" }));
    fireEvent.click(screen.getByRole("button", { name: "save changes" }));
    await waitFor(() => expect(db.saves).toHaveBeenCalledTimes(2));
    expect(db.saves.mock.calls).toEqual([
      ["drop_items", "croissant", { sort: 1 }],
      ["drop_items", "focaccia", { sort: 2 }],
    ]);
    expect(await screen.findByText("saved.")).toBeInTheDocument();
    expect(names()).toEqual(["croissant", "focaccia", "danish"]);
  });

  it("is no longer unsaved when an item is moved back to where it was", async () => {
    render(<Admin />);
    await screen.findByLabelText("description for focaccia");
    fireEvent.click(screen.getByRole("button", { name: "move croissant up" }));
    fireEvent.click(screen.getByRole("button", { name: "move croissant down" }));
    expect(screen.queryByText("unsaved changes")).not.toBeInTheDocument();
  });
});
