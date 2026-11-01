import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Admin from "@/pages/Admin";

const db = vi.hoisted(() => ({
  items: [] as Record<string, unknown>[],
  archiveError: null as string | null,
  archives: vi.fn(),
}));

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
        if (table === "item_groups") return { data: [{ id: "group", name: "loaves", total_qty: 10, sort: 1 }], error: null };
        if (table === "orders") return { data: [{
          id: "order", customer_name: "customer", email: "", phone: "", sms_opt_in: false,
          items: [{ item_id: "bread", name: "sourdough", qty: 2 }], total_cents: 2400,
          discount_code: null, discount_percent: null, status: "paid", is_test: false,
        }], error: null };
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
          db.archives(table, id, patch);
          if (db.archiveError) return { data: null, error: { message: db.archiveError } };
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
    id: "bread", name: "sourdough", description: "", ingredients: "", price_cents: 1200,
    total_qty: 10, min_per_order: 1, max_per_order: 2, sort: 1,
    image_url: null, group_id: "group", archived: false,
  }];
  db.archiveError = null;
  db.archives.mockClear();
});
afterEach(cleanup);

async function openDelete() {
  render(<Admin />);
  fireEvent.click(await screen.findByRole("button", { name: "delete sourdough" }));
  return screen.getByRole("alertdialog");
}

describe("admin menu deletion", () => {
  it("cancels without changing the item", async () => {
    const dialog = await openDelete();
    fireEvent.click(within(dialog).getByRole("button", { name: "cancel" }));
    expect(screen.getByRole("button", { name: "delete sourdough" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "save changes" })).toBeDisabled();
    expect(db.archives).not.toHaveBeenCalled();
  });

  it("stages deletion and allows discard before saving", async () => {
    const dialog = await openDelete();
    fireEvent.click(within(dialog).getByRole("button", { name: "delete item" }));
    expect(screen.queryByRole("button", { name: "delete sourdough" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "save changes" })).toBeEnabled();
    expect(db.archives).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "discard" }));
    expect(screen.getByRole("button", { name: "delete sourdough" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "save changes" })).toBeDisabled();
  });

  it("archives on save, preserves orders and group sold counts, and stays deleted after reload", async () => {
    const dialog = await openDelete();
    fireEvent.click(within(dialog).getByRole("button", { name: "delete item" }));
    fireEvent.click(screen.getByRole("button", { name: "save changes" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "save changes" })).toBeDisabled());
    expect(db.archives).toHaveBeenCalledExactlyOnceWith("drop_items", "bread", { archived: true });
    expect(db.items[0].archived).toBe(true);
    expect(screen.getByText(/sold 2 \/ 10/)).toBeInTheDocument();
    expect(screen.getByText("2× sourdough")).toBeInTheDocument();
    cleanup();
    render(<Admin />);
    await screen.findByText(/sold 2 \/ 10/);
    expect(screen.queryByRole("button", { name: "delete sourdough" })).not.toBeInTheDocument();
  });

  it("shows save failures and keeps deletion available to retry", async () => {
    db.archiveError = "permission denied";
    const dialog = await openDelete();
    fireEvent.click(within(dialog).getByRole("button", { name: "delete item" }));
    fireEvent.click(screen.getByRole("button", { name: "save changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent("couldn't save: permission denied");
    expect(db.items[0].archived).toBe(false);
    expect(screen.getByRole("button", { name: "save changes" })).toBeEnabled();
    db.archiveError = null;
    fireEvent.click(screen.getByRole("button", { name: "save changes" }));
    await waitFor(() => expect(db.items[0].archived).toBe(true));
  });

  it("removes unsaved new items without confirmation or a database write", async () => {
    render(<Admin />);
    fireEvent.click(await screen.findByRole("button", { name: "+ add more items" }));
    fireEvent.click(screen.getByRole("button", { name: "remove new item" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "save changes" })).toBeDisabled();
    expect(db.archives).not.toHaveBeenCalled();
  });
});
