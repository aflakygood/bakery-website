import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Admin from "@/pages/Admin";
import { pastDropTitle } from "@/lib/drop";

const dropRow = (id: string, title: string, created_at: string, pickup_date: string | null) => ({
  id, title, created_at, pickup_date, is_open: true, opens_at: null, closes_at: null, pickup_start: null, pickup_end: null, pickup_location: "",
});
const order = (id: string, drop_id: string, name: string, total_cents: number, status = "paid", is_test = false) => ({
  id, drop_id, customer_name: name, email: "", phone: "", sms_opt_in: false, items: [{ name: "sourdough", qty: 1 }],
  total_cents, discount_code: null, discount_percent: null, status, is_test,
});

const db = vi.hoisted(() => ({ drops: [] as Record<string, unknown>[], orders: [] as Record<string, unknown>[], items: [] as Record<string, unknown>[] }));

vi.mock("@/integrations/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      getSession: async () => ({ data: { session: { user: { id: "owner" } } } }),
    },
    rpc: async () => ({ data: true }),
    from: (table: string) => {
      let limited = false;
      let dropId: unknown;
      let dropIds: unknown[] | null = null;
      const result = () => {
        if (table === "drops") return { data: limited ? db.drops[0] : db.drops, error: null };
        if (table === "orders") {
          return { data: db.orders.filter((o) => (dropId ? o.drop_id === dropId : dropIds ? dropIds.includes(o.drop_id) : true)), error: null };
        }
        if (table === "drop_items") return { data: dropIds ? db.items.filter((i) => dropIds!.includes(i.drop_id)) : [], error: null };
        return { data: [], error: null };
      };
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((column: string, value: unknown) => { if (column === "drop_id") dropId = value; return query; }),
        in: vi.fn((column: string, values: unknown[]) => { if (column === "drop_id") dropIds = values; return query; }),
        limit: vi.fn(() => { limited = true; return query; }),
        order: vi.fn(() => query),
        then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
        maybeSingle: vi.fn(async () => result()),
      };
      return query;
    },
  },
}));

afterEach(cleanup);

describe("previous drops", () => {
  it("titles a drop with its name and pickup date, falling back to the created date", () => {
    expect(pastDropTitle({ title: "spring bake", pickup_date: "2026-10-24", created_at: "2026-10-20T12:00:00Z" })).toBe("spring bake · Saturday Oct 24");
    expect(pastDropTitle({ title: " ", pickup_date: null, created_at: "2026-10-20T12:00:00Z" })).toBe("this week's drop · created Oct 20, 2026");
  });

  it("keeps earlier drops and their paid orders in the previous drops tab, apart from the current drop", async () => {
    db.drops = [
      dropRow("new", "fall bake", "2026-11-01T12:00:00Z", null),
      dropRow("old", "this week's drop", "2026-10-20T12:00:00Z", "2026-10-24"),
    ];
    db.orders = [order("a", "old", "alice", 2400), order("b", "old", "bob", 1200, "picked_up"), order("t", "old", "tester", 500, "paid", true), order("c", "new", "carol", 900)];
    db.items = [
      { id: "i1", drop_id: "old", name: "sourdough", price_cents: 1200, variants: [], total_qty: 10, sort: 1, image_url: "https://cdn.test/old-sourdough.jpg", archived: true },
      { id: "i2", drop_id: "new", name: "croissant", price_cents: 500, variants: [], total_qty: 10, sort: 1, image_url: null, archived: false },
    ];
    render(<Admin />);
    expect(await screen.findByText("paid orders (1).")).toBeInTheDocument();
    expect(screen.getByText(/carol/)).toBeInTheDocument();
    expect(screen.queryByText(/alice/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "previous drops" }));
    const header = await screen.findByRole("button", { name: /this week's drop · Saturday Oct 24/ });
    expect(header).toHaveTextContent("3 paid orders · $36.00");
    expect(screen.queryByText(/carol/)).not.toBeInTheDocument();

    fireEvent.click(header);
    expect(screen.getByText(/alice/)).toBeInTheDocument();
    expect(screen.getByText(/bob/)).toBeInTheDocument();
    expect(screen.getByText("picked up")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "sourdough" })).toHaveAttribute("src", "https://cdn.test/old-sourdough.jpg");
    expect(screen.queryByRole("img", { name: "croissant" })).not.toBeInTheDocument();
  });
});
