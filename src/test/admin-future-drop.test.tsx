import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Admin from "@/pages/Admin";

const drop = (id: string, title: string, is_draft: boolean) => ({
  id, title, is_draft, is_open: true, opens_at: is_draft ? null : "2020-01-01T00:00:00Z", closes_at: null,
  pickup_date: null, pickup_start: null, pickup_end: null, pickup_location: "", created_at: "2026-11-01T00:00:00Z",
});
const item = (id: string, drop_id: string, name: string) => ({
  id, drop_id, name, description: "", ingredients: "", price_cents: 1200, variants: [], total_qty: 0,
  min_per_order: 1, max_per_order: 2, sort: 1, image_url: null, group_id: null, archived: false,
});

const db = vi.hoisted(() => ({
  drops: [] as Record<string, unknown>[],
  items: [] as Record<string, unknown>[],
  rpc: vi.fn(),
  deleted: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      getSession: async () => ({ data: { session: { user: { id: "owner" } } } }),
    },
    rpc: async (name: string) => (name === "has_role" ? { data: true } : db.rpc(name)),
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      let deleting = false;
      const result = () => {
        if (table === "drops") return { data: db.drops.filter((d) => ("is_draft" in filters ? d.is_draft === filters.is_draft : true) && (!filters.id || d.id === filters.id)), error: null };
        if (table === "drop_items") return { data: db.items.filter((i) => i.drop_id === filters.drop_id), error: null };
        return { data: [], error: null };
      };
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((column: string, value: unknown) => { filters[column] = value; return query; }),
        in: vi.fn(() => query),
        limit: vi.fn(() => query),
        order: vi.fn(() => query),
        delete: vi.fn(() => { deleting = true; return query; }),
        then: (resolve: (value: unknown) => unknown) => {
          if (deleting) db.deleted(table, filters);
          return Promise.resolve(deleting ? { error: null } : result()).then(resolve);
        },
        maybeSingle: vi.fn(async () => ({ data: result().data?.[0] ?? null, error: null })),
      };
      return query;
    },
  },
}));

beforeEach(() => {
  db.drops = [drop("live", "this week", false)];
  db.items = [item("a", "live", "sourdough"), item("b", "future", "pumpkin loaf")];
  db.rpc.mockReset();
  db.deleted.mockReset();
  db.rpc.mockResolvedValue({ data: "future", error: null });
});
afterEach(cleanup);

const openFuture = async () => {
  render(<Admin />);
  await screen.findByRole("heading", { name: "this drop." });
  fireEvent.click(screen.getByRole("tab", { name: "future drop" }));
};

describe("future drop tab", () => {
  it("has future, current and previous tabs, defaulting to the current drop", async () => {
    render(<Admin />);
    expect(await screen.findByRole("heading", { name: "this drop." })).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["future drop", "this drop", "previous drops"]);
    expect(screen.getByRole("tab", { name: "this drop" })).toHaveAttribute("aria-selected", "true");
  });

  it("offers to plan a future drop when none exists, and loads it after creating one", async () => {
    await openFuture();
    fireEvent.click(await screen.findByRole("button", { name: "plan a future drop" }));
    db.drops.push(drop("future", "next week", true));
    await screen.findByRole("heading", { name: "future drop." });
    expect(db.rpc).toHaveBeenCalledWith("create_future_drop");
    expect(screen.getByDisplayValue("pumpkin loaf")).toBeInTheDocument();
  });

  it("edits the planned drop apart from the current one, with no orders or start-next-drop controls", async () => {
    db.drops.push(drop("future", "next week", true));
    await openFuture();
    expect(await screen.findByDisplayValue("pumpkin loaf")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("sourdough")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "start next drop" })).not.toBeInTheDocument();
    expect(screen.queryByText(/paid orders/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "this drop" }));
    expect(await screen.findByDisplayValue("sourdough")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("pumpkin loaf")).not.toBeInTheDocument();
  });

  it("makes the planned drop current with one confirmed click", async () => {
    db.drops.push(drop("future", "next week", true));
    await openFuture();
    fireEvent.click(await screen.findByRole("button", { name: "make current drop" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "make current" }));
    await waitFor(() => expect(db.rpc).toHaveBeenCalledWith("publish_future_drop"));
    expect(await screen.findByRole("heading", { name: "this drop." })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "this drop" })).toHaveAttribute("aria-selected", "true");
  });

  it("warns that an active current drop will be replaced, and explains what happens", async () => {
    db.drops.push(drop("future", "next week", true));
    await openFuture();
    fireEvent.click(await screen.findByRole("button", { name: "make current drop" }));
    const dialog = screen.getByRole("alertdialog");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/"this week" is still taking preorders. it will be replaced/);
    expect(within(dialog).getByText(/closed now and saved under previous drops/)).toBeInTheDocument();
    expect(within(dialog).getByText(/paid orders list starts empty/)).toBeInTheDocument();
  });

  it("shows no warning when the current drop has ended or is closed", async () => {
    db.drops = [{ ...drop("live", "this week", false), closes_at: "2020-02-01T00:00:00Z" }, drop("future", "next week", true)];
    await openFuture();
    fireEvent.click(await screen.findByRole("button", { name: "make current drop" }));
    const dialog = screen.getByRole("alertdialog");
    expect(await within(dialog).findByText(/closed now and saved under previous drops/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("only deletes a drop that is still a draft when discarding", async () => {
    db.drops.push(drop("future", "next week", true));
    await openFuture();
    fireEvent.click(await screen.findByRole("button", { name: "discard future drop" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "discard" }));
    await waitFor(() => expect(db.deleted).toHaveBeenCalledWith("drops", { id: "future", is_draft: true }));
  });
});
