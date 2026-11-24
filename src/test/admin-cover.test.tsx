import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Admin from "@/pages/Admin";

const db = vi.hoisted(() => ({ cover_url: null as string | null, map: null as string | null, dropUpdates: vi.fn(), upload: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      getSession: async () => ({ data: { session: { user: { id: "owner" } } } }),
    },
    rpc: async () => ({ data: true }),
    storage: {
      from: () => ({
        upload: async (path: string) => { db.upload(path); return { error: null }; },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
      }),
    },
    from: (table: string) => {
      let patch: Record<string, unknown> | null = null;
      const result = () => table === "drops"
        ? { data: {
          id: "drop", title: "this week", is_open: true, opens_at: null, closes_at: null, cover_url: db.cover_url, pickup_map_url: db.map,
          pickup_date: null, pickup_start: null, pickup_end: null, pickup_location: "",
        }, error: null }
        : { data: [], error: null };
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        in: vi.fn(() => query),
        limit: vi.fn(() => query),
        order: vi.fn(() => query),
        update: vi.fn((values: Record<string, unknown>) => { patch = values; return query; }),
        then: (resolve: (value: unknown) => unknown) => {
          if (patch && table === "drops") { db.dropUpdates(patch); if ("cover_url" in patch) db.cover_url = patch.cover_url as string | null; }
          return Promise.resolve(result()).then(resolve);
        },
        maybeSingle: vi.fn(async () => result()),
      };
      return query;
    },
  },
}));

beforeEach(() => {
  db.cover_url = null;
  db.map = null;
  db.dropUpdates.mockClear();
  db.upload.mockClear();
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:preview", revokeObjectURL: vi.fn() }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const photo = new File(["x"], "cover.jpg", { type: "image/jpeg" });

describe("admin drop cover image", () => {
  it("uploads a new cover and saves its url on the drop", async () => {
    render(<Admin />);
    fireEvent.change(await screen.findByLabelText("change cover image"), { target: { files: [photo] } });
    expect(screen.getByText("unsaved changes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "save changes" }));
    await waitFor(() => expect(db.dropUpdates).toHaveBeenCalledWith({ cover_url: expect.stringMatching(/^https:\/\/cdn\.test\/.+\.jpg$/) }));
    expect(db.upload).toHaveBeenCalledOnce();
  });

  it("goes back to the default cover with 'use default'", async () => {
    db.cover_url = "https://cdn.test/old.jpg";
    render(<Admin />);
    fireEvent.click(await screen.findByRole("button", { name: "use default" }));
    fireEvent.click(screen.getByRole("button", { name: "save changes" }));
    await waitFor(() => expect(db.dropUpdates).toHaveBeenCalledWith({ cover_url: null }));
    expect(db.upload).not.toHaveBeenCalled();
  });

  it("rejects files that aren't png, jpg or webp", async () => {
    render(<Admin />);
    fireEvent.change(await screen.findByLabelText("change cover image"), { target: { files: [new File(["x"], "a.gif", { type: "image/gif" })] } });
    expect(await screen.findByRole("status")).toHaveTextContent("photos must be png, jpg or webp.");
    expect(screen.queryByText("unsaved changes")).not.toBeInTheDocument();
  });
});

describe("admin pickup map link", () => {
  it("saves an edited google maps link and clears it when emptied", async () => {
    db.map = "https://maps.app.goo.gl/old";
    render(<Admin />);
    const input = await screen.findByLabelText(/google maps link/);
    expect(input).toHaveValue("https://maps.app.goo.gl/old");
    fireEvent.change(input, { target: { value: " https://maps.app.goo.gl/new " } });
    fireEvent.click(screen.getByRole("button", { name: "save changes" }));
    await waitFor(() => expect(db.dropUpdates).toHaveBeenCalledWith({ pickup_map_url: "https://maps.app.goo.gl/new" }));
    fireEvent.change(await screen.findByLabelText(/google maps link/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "save changes" }));
    await waitFor(() => expect(db.dropUpdates).toHaveBeenCalledWith({ pickup_map_url: null }));
  });

  it("rejects a link that isn't a web address", async () => {
    render(<Admin />);
    fireEvent.change(await screen.findByLabelText(/google maps link/), { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "save changes" }));
    expect(await screen.findByRole("status")).toHaveTextContent("the google maps link must start with https://.");
    expect(db.dropUpdates).not.toHaveBeenCalled();
  });
});
