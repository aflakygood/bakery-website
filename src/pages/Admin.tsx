import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { pickupWhen, type PickupFields } from "@/lib/pickup";
import { dropPhase, useNow, type DropSchedule } from "@/lib/drop";
import { itemImage } from "@/lib/itemImage";
import { usePageMeta } from "@/lib/seo";
import { MAX_VARIANTS, parseVariants, type Variant } from "@/lib/variants";
import PreviousDrops from "@/components/admin/PreviousDrops";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Order = { id: string; customer_name: string; email: string; phone: string; sms_opt_in: boolean; items: { item_id?: string; name: string; qty: number }[]; total_cents: number; discount_code: string | null; discount_percent: number | null; status: string; is_test: boolean; created_at: string };
type Item = { id: string; name: string; description: string; ingredients: string; price_cents: number; variants?: Variant[]; total_qty: number; min_per_order: number; max_per_order: number; sort: number; image_url: string | null; group_id: string | null; archived: boolean };
// Items in a stock group share the group's spots instead of having their own.
type Group = { id: string; name: string; total_qty: number; sort: number };
type Drop = PickupFields & DropSchedule & { id: string; title: string; is_draft?: boolean };

// <input type="datetime-local"> works in the admin's local time; the database stores UTC.
const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);
const phaseLabel = { upcoming: "not live yet", open: "taking preorders", ended: "ended (shows sold out)", closed: "closed early" } as const;

type DropDraft = { title: string; opens_at: string; closes_at: string; pickup_date: string; pickup_start: string; pickup_end: string; pickup_location: string };
// group is the key of a GroupRow, or "" when the item has its own spots.
// variants: optional sizes/options, each with its own price; when present they replace the single price.
type VariantDraft = { id: string; label: string; price: string };
type ItemDraft = { name: string; price: string; variants: VariantDraft[]; total_qty: string; min_per_order: string; max_per_order: string; description: string; ingredients: string; image_url: string | null; group: string };
type GroupDraft = { name: string; total_qty: string };
type GroupRow = { key: string; id: string | null; draft: GroupDraft };
// One editable menu row. id is null for items added here that haven't been saved yet.
type Row = { key: string; id: string | null; draft: ItemDraft; file: File | null; preview: string | null };
const dropDraftOf = (d: Drop): DropDraft => ({
  title: d.title ?? "",
  opens_at: toLocalInput(d.opens_at),
  closes_at: toLocalInput(d.closes_at),
  pickup_date: d.pickup_date ?? "",
  pickup_start: d.pickup_start?.slice(0, 5) ?? "",
  pickup_end: d.pickup_end?.slice(0, 5) ?? "",
  pickup_location: d.pickup_location ?? "",
});
const itemDraftOf = (i: Item): ItemDraft => ({
  name: i.name,
  price: String(i.price_cents / 100),
  variants: parseVariants(i.variants).map((v) => ({ id: v.id, label: v.label, price: String(v.price_cents / 100) })),
  total_qty: String(i.total_qty),
  min_per_order: String(i.min_per_order ?? 1),
  max_per_order: String(i.max_per_order),
  description: i.description ?? "",
  ingredients: i.ingredients ?? "",
  image_url: i.image_url ?? null,
  group: i.group_id ?? "",
});
const groupDraftOf = (g: Group): GroupDraft => ({ name: g.name, total_qty: String(g.total_qty) });
const groupRowsOf = (groups: Group[]): GroupRow[] => groups.map((g) => ({ key: g.id, id: g.id, draft: groupDraftOf(g) }));
const rowsOf = (items: Item[]): Row[] => items.filter((item) => !item.archived).map((item) => ({ key: item.id, id: item.id, draft: itemDraftOf(item), file: null, preview: null }));
const blankDraft: ItemDraft = { name: "", price: "", variants: [], total_qty: "0", min_per_order: "1", max_per_order: "2", description: "", ingredients: "", image_url: null, group: "" };
const photoTypes: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const same = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

export default function Admin() {
  usePageMeta({ title: "admin · a flaky good.", path: "/admin", noindex: true });
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [liveDrop, setLiveDrop] = useState<{ title: string; schedule: DropSchedule; paidOrders: number } | null>(null);
  const [dropDraft, setDropDraft] = useState<DropDraft | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupRows, setGroupRows] = useState<GroupRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState<"close" | "next" | "publish" | "discard" | null>(null);
  const [confirmingItem, setConfirmingItem] = useState<Row | null>(null);
  const [tab, setTab] = useState<"future" | "current" | "previous">("current");
  const [loading, setLoading] = useState(false);
  const planning = tab === "future";
  const now = useNow();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  // resetDrafts=false keeps unsaved edits (e.g. after marking an order picked up).
  // kind picks which drop the editor works on: the live (latest) drop, or the planned future drop.
  const load = async (resetDrafts = true, kind: "future" | "current" = "current") => {
    const { data: latestDrop } = await supabase.from("drops").select("*").eq("is_draft", kind === "future").order("created_at", { ascending: false }).limit(1).maybeSingle();
    setDrop(latestDrop);
    if (resetDrafts) setDropDraft(latestDrop ? dropDraftOf(latestDrop) : null);
    if (!latestDrop) return;
    const { data: dropGroups } = await supabase.from("item_groups").select("*").eq("drop_id", latestDrop.id).order("sort");
    setGroups((dropGroups ?? []) as Group[]);
    if (resetDrafts) setGroupRows(groupRowsOf((dropGroups ?? []) as Group[]));
    const { data: dropItems } = await supabase.from("drop_items").select("*").eq("drop_id", latestDrop.id).order("sort");
    setItems((dropItems ?? []) as Item[]);
    if (resetDrafts) setRows(rowsOf((dropItems ?? []) as Item[]));
    if (kind === "future") {
      setOrders([]);
      const { data: live } = await supabase.from("drops").select("*").eq("is_draft", false).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!live) return setLiveDrop(null);
      const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("drop_id", live.id).in("status", ["paid", "picked_up"]);
      return setLiveDrop({ title: live.title, schedule: live, paidOrders: count ?? 0 });
    }
    const { data: paidOrders } = await supabase.from("orders").select("*").eq("drop_id", latestDrop.id).in("status", ["paid", "picked_up"]).order("created_at");
    setOrders((paidOrders ?? []) as unknown as Order[]);
  };

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (!session) return setIsAdmin(null);
    supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(!!data);
      if (data) void load();
    });
  // Keyed on the user id: Supabase re-emits the session when the tab regains focus, which must not reload and wipe unsaved edits.
  }, [session?.user.id]);

  const signIn = () => supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/admin` },
  });

  const rowChanged = (row: Row) => {
    const item = row.id ? items.find((i) => i.id === row.id) : undefined;
    return !item || !!row.file || !same(row.draft, itemDraftOf(item));
  };
  const groupChanged = (row: GroupRow) => {
    const group = row.id ? groups.find((g) => g.id === row.id) : undefined;
    return !group || !same(row.draft, groupDraftOf(group));
  };
  const removedGroups = groups.filter((g) => !groupRows.some((row) => row.id === g.id));
  const removedItems = items.filter((item) => !item.archived && !rows.some((row) => row.id === item.id));
  const dirty = !!drop && !!dropDraft && (!same(dropDraft, dropDraftOf(drop)) || rows.some(rowChanged) || groupRows.some(groupChanged) || removedGroups.length > 0 || removedItems.length > 0);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const editDrop = (patch: Partial<DropDraft>) => { setNotice(null); setDropDraft((d) => (d ? { ...d, ...patch } : d)); };
  const updateRow = (key: string, patch: Partial<Row>) => setRows((all) => all.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const editItem = (key: string, patch: Partial<ItemDraft>) => {
    setNotice(null);
    setRows((all) => all.map((row) => (row.key === key ? { ...row, draft: { ...row.draft, ...patch } } : row)));
  };
  const pickPhoto = (row: Row, file: File | undefined) => {
    if (!file) return;
    if (!photoTypes[file.type]) return setNotice({ ok: false, text: "photos must be png, jpg or webp." });
    if (file.size > 5 * 1024 * 1024) return setNotice({ ok: false, text: "photos must be under 5 MB." });
    if (row.preview) URL.revokeObjectURL(row.preview);
    setNotice(null);
    updateRow(row.key, { file, preview: URL.createObjectURL(file) });
  };
  const clearPhoto = (row: Row) => {
    if (row.preview) URL.revokeObjectURL(row.preview);
    setNotice(null);
    setRows((all) => all.map((r) => (r.key === row.key ? { ...r, file: null, preview: null, draft: { ...r.draft, image_url: null } } : r)));
  };
  const addItem = () => {
    setNotice(null);
    setRows((all) => [...all, { key: `new-${crypto.randomUUID()}`, id: null, draft: { ...blankDraft }, file: null, preview: null }]);
  };
  const addGroup = () => {
    setNotice(null);
    setGroupRows((all) => [...all, { key: `new-${crypto.randomUUID()}`, id: null, draft: { name: "", total_qty: "0" } }]);
  };
  const editGroup = (key: string, patch: Partial<GroupDraft>) => {
    setNotice(null);
    setGroupRows((all) => all.map((row) => (row.key === key ? { ...row, draft: { ...row.draft, ...patch } } : row)));
  };
  // Items in a removed group go back to their own spots.
  const removeGroup = (key: string) => {
    setNotice(null);
    setGroupRows((all) => all.filter((row) => row.key !== key));
    setRows((all) => all.map((row) => (row.draft.group === key ? { ...row, draft: { ...row.draft, group: "" } } : row)));
  };
  const addVariant = (key: string) => {
    setNotice(null);
    setRows((all) => all.map((row) => (row.key === key && row.draft.variants.length < MAX_VARIANTS
      ? { ...row, draft: { ...row.draft, variants: [...row.draft.variants, { id: crypto.randomUUID().replace(/-/g, "").slice(0, 8), label: "", price: "" }] } }
      : row)));
  };
  const editVariant = (key: string, id: string, patch: Partial<VariantDraft>) => {
    setNotice(null);
    setRows((all) => all.map((row) => (row.key === key
      ? { ...row, draft: { ...row.draft, variants: row.draft.variants.map((v) => (v.id === id ? { ...v, ...patch } : v)) } }
      : row)));
  };
  const removeVariant = (key: string, id: string) => {
    setNotice(null);
    setRows((all) => all.map((row) => (row.key === key ? { ...row, draft: { ...row.draft, variants: row.draft.variants.filter((v) => v.id !== id) } } : row)));
  };
  const removeItem = (row: Row) => {
    if (row.preview) URL.revokeObjectURL(row.preview);
    setNotice(null);
    setRows((all) => all.filter((r) => r.key !== row.key));
  };

  const save = async () => {
    if (!drop || !dropDraft) return;
    const base = dropDraftOf(drop);
    const dropPatch: Record<string, string | null> = {};
    const title = dropDraft.title.trim();
    if (!title) return setNotice({ ok: false, text: "give the drop a title." });
    if (title.length > 80) return setNotice({ ok: false, text: "drop title is too long (80 characters max)." });
    if (title !== base.title) dropPatch.title = title;
    if (dropDraft.opens_at !== base.opens_at) dropPatch.opens_at = fromLocalInput(dropDraft.opens_at);
    if (dropDraft.closes_at !== base.closes_at) dropPatch.closes_at = fromLocalInput(dropDraft.closes_at);
    if (dropDraft.pickup_date !== base.pickup_date) dropPatch.pickup_date = dropDraft.pickup_date || null;
    if (dropDraft.pickup_start !== base.pickup_start) dropPatch.pickup_start = dropDraft.pickup_start || null;
    if (dropDraft.pickup_end !== base.pickup_end) dropPatch.pickup_end = dropDraft.pickup_end || null;
    if (dropDraft.pickup_location !== base.pickup_location) dropPatch.pickup_location = dropDraft.pickup_location;
    if (dropDraft.opens_at && dropDraft.closes_at && dropDraft.closes_at <= dropDraft.opens_at)
      return setNotice({ ok: false, text: "closes must be after opens." });

    const changedGroups = groupRows.filter(groupChanged);
    const groupFields: Record<string, Pick<Group, "name" | "total_qty">> = {};
    const groupNames = new Set<string>();
    for (const row of groupRows) {
      const name = row.draft.name.trim(), qty = Number(row.draft.total_qty);
      if (!name) return setNotice({ ok: false, text: "every stock group needs a name." });
      if (name.length > 80) return setNotice({ ok: false, text: `${name.slice(0, 20)}… is too long a group name (80 characters max).` });
      if (groupNames.has(name.toLowerCase())) return setNotice({ ok: false, text: `there are two stock groups called ${name}.` });
      groupNames.add(name.toLowerCase());
      if (row.draft.total_qty === "" || !Number.isInteger(qty) || qty < 0) return setNotice({ ok: false, text: `total spots for ${name} must be a whole number.` });
      groupFields[row.key] = { name, total_qty: qty };
    }

    const changed = rows.filter(rowChanged);
    const fields: Record<string, Pick<Item, "name" | "price_cents" | "total_qty" | "min_per_order" | "max_per_order" | "description" | "ingredients"> & { variants: Variant[] }> = {};
    for (const row of changed) {
      const d = row.draft, name = d.name.trim();
      if (!name) return setNotice({ ok: false, text: "every item needs a name." });
      if (name.length > 80) return setNotice({ ok: false, text: `${name.slice(0, 20)}… is too long a name (80 characters max).` });
      const variants: Variant[] = [];
      const variantLabels = new Set<string>();
      for (const v of d.variants) {
        const label = v.label.trim(), variantPrice = Number(v.price);
        if (!label) return setNotice({ ok: false, text: `every variation of ${name} needs a name.` });
        if (label.length > 40) return setNotice({ ok: false, text: `${label.slice(0, 20)}… is too long a variation name (40 characters max).` });
        if (variantLabels.has(label.toLowerCase())) return setNotice({ ok: false, text: `${name} has two variations called ${label}.` });
        variantLabels.add(label.toLowerCase());
        if (v.price === "" || !Number.isFinite(variantPrice) || variantPrice < 0) return setNotice({ ok: false, text: `check the price for ${name} (${label}).` });
        variants.push({ id: v.id, label, price_cents: Math.round(variantPrice * 100) });
      }
      const price = Number(d.price), qty = Number(d.total_qty), min = Number(d.min_per_order), max = Number(d.max_per_order);
      if (!variants.length && (d.price === "" || !Number.isFinite(price) || price < 0)) return setNotice({ ok: false, text: `check the price for ${name}.` });
      if (d.total_qty === "" || !Number.isInteger(qty) || qty < 0) return setNotice({ ok: false, text: `total spots for ${name} must be a whole number.` });
      if (!Number.isInteger(max) || max < 1) return setNotice({ ok: false, text: `max / order for ${name} must be at least 1.` });
      if (!Number.isInteger(min) || min < 1) return setNotice({ ok: false, text: `min / order for ${name} must be at least 1.` });
      if (min > max) return setNotice({ ok: false, text: `min / order for ${name} can't be more than max / order.` });
      // With variations the item's own price is just the lowest one (the menu shows "from $x").
      const priceCents = variants.length ? Math.min(...variants.map((v) => v.price_cents)) : Math.round(price * 100);
      fields[row.key] = { name, price_cents: priceCents, variants, total_qty: qty, min_per_order: min, max_per_order: max, description: d.description, ingredients: d.ingredients.trim() };
    }

    setSaving(true);
    let error: string | null = null;
    if (Object.keys(dropPatch).length) {
      const result = await supabase.from("drops").update(dropPatch).eq("id", drop.id);
      if (result.error) error = result.error.message;
    }
    // Save groups before items so new groups have ids to assign.
    const groupIds = new Map(groupRows.filter((row) => row.id).map((row) => [row.key, row.id as string]));
    let nextGroupSort = Math.max(0, ...groups.map((g) => g.sort)) + 1;
    for (const row of changedGroups) {
      if (error) break;
      const values = groupFields[row.key];
      const result = row.id
        ? await supabase.from("item_groups").update(values).eq("id", row.id).select("id").single()
        : await supabase.from("item_groups").insert({ ...values, drop_id: drop.id, sort: nextGroupSort++ }).select("id").single();
      if (result.error) { error = result.error.message; break; }
      groupIds.set(row.key, result.data.id);
      setGroupRows((all) => all.map((r) => (r.key === row.key ? { ...r, id: result.data.id } : r)));
    }
    let nextSort = Math.max(0, ...items.map((item) => item.sort)) + 1;
    for (const row of changed) {
      if (error) break;
      let imageUrl = row.draft.image_url;
      if (row.file) {
        const path = `${crypto.randomUUID()}.${photoTypes[row.file.type]}`;
        const upload = await supabase.storage.from("product-images").upload(path, row.file, { contentType: row.file.type, cacheControl: "31536000" });
        if (upload.error) { error = upload.error.message; break; }
        imageUrl = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      }
      const values = { ...fields[row.key], image_url: imageUrl, group_id: row.draft.group ? groupIds.get(row.draft.group) ?? null : null };
      const result = row.id
        ? await supabase.from("drop_items").update(values).eq("id", row.id).select("id").single()
        : await supabase.from("drop_items").insert({ ...values, drop_id: drop.id, sort: nextSort++ }).select("id").single();
      if (result.error) { error = result.error.message; break; }
      // Record progress so a retry after a partial failure doesn't re-insert or re-upload.
      if (row.preview) URL.revokeObjectURL(row.preview);
      updateRow(row.key, { id: result.data.id, file: null, preview: null, draft: { ...row.draft, name: values.name, image_url: imageUrl } });
    }
    for (const item of removedItems) {
      if (error) break;
      const result = await supabase.from("drop_items").update({ archived: true }).eq("id", item.id).eq("drop_id", drop.id).select("id").single();
      if (result.error) error = result.error.message;
    }
    for (const group of removedGroups) {
      if (error) break;
      const result = await supabase.from("item_groups").delete().eq("id", group.id);
      if (result.error) error = result.error.message;
    }
    setSaving(false);
    setNotice(error ? { ok: false, text: `couldn't save: ${error}` } : { ok: true, text: "saved." });
    await load(!error, drop.is_draft ? "future" : "current");
  };
  const discard = () => {
    if (!drop) return;
    setNotice(null);
    setDropDraft(dropDraftOf(drop));
    rows.forEach((row) => row.preview && URL.revokeObjectURL(row.preview));
    setRows(rowsOf(items));
    setGroupRows(groupRowsOf(groups));
  };
  const setOpen = async (isOpen: boolean) => {
    if (!drop) return;
    const { error } = await supabase.from("drops").update({ is_open: isOpen }).eq("id", drop.id);
    setNotice(error ? { ok: false, text: `couldn't update: ${error.message}` } : { ok: true, text: isOpen ? "preorders reopened." : "preorders closed." });
    await load(false);
  };
  const startNextDrop = async () => {
    const { error } = await supabase.rpc("start_next_drop");
    if (error) return setNotice({ ok: false, text: `couldn't start the next drop: ${error.message}` });
    setNotice({ ok: true, text: "next drop started. set the quantities and open time, then save. the last drop and its orders are saved under previous drops." });
    setTab("current");
    await load(true);
  };
  const markPicked = async (id: string) => {
    await supabase.from("orders").update({ status: "picked_up" }).eq("id", id);
    void load(false);
  };
  const switchTab = async (next: "future" | "current" | "previous") => {
    if (next === tab) return;
    if (dirty && !window.confirm("you have unsaved changes. discard them?")) return;
    setNotice(null);
    if (next === "previous") {
      discard();
      return setTab(next);
    }
    setTab(next);
    setLoading(true);
    await load(true, next);
    setLoading(false);
  };
  const planFutureDrop = async () => {
    const { error } = await supabase.rpc("create_future_drop");
    if (error) return setNotice({ ok: false, text: `couldn't create the future drop: ${error.message}` });
    setNotice({ ok: true, text: "future drop created from the current menu. set the details, quantities and open time, then save." });
    await load(true, "future");
  };
  const publishFutureDrop = async () => {
    const { error } = await supabase.rpc("publish_future_drop");
    if (error) return setNotice({ ok: false, text: `couldn't make it the current drop: ${error.message}` });
    setNotice({ ok: true, text: "the future drop is now the current drop. the last drop and its orders are saved under previous drops." });
    setTab("current");
    await load(true, "current");
  };
  const discardFutureDrop = async () => {
    if (!drop?.is_draft) return;
    const { error } = await supabase.from("drops").delete().eq("id", drop.id).eq("is_draft", true);
    if (error) return setNotice({ ok: false, text: `couldn't discard the future drop: ${error.message}` });
    setNotice({ ok: true, text: "future drop discarded." });
    await load(true, "future");
  };
  type ConfirmCopy = { title: string; body: string; steps?: string[]; warning?: string; action: string; run: () => unknown };
  const confirmCopy: Record<"close" | "next" | "publish" | "discard", ConfirmCopy> = {
    close: { title: "close preorders now?", body: "customers won't be able to order from this drop until you reopen it.", action: "close now", run: () => setOpen(false) },
    next: {
      title: "start the next drop?",
      body: `this ends the current drop now and saves it, with all its orders, under previous drops. the new drop starts with an empty paid orders list, copies the items, prices and stock groups with 0 spots, and stays hidden until you set its open time.${dirty ? " your unsaved changes will be discarded." : ""}`,
      action: "start next drop",
      run: startNextDrop,
    },
    publish: {
      title: "make this the current drop?",
      body: "here's what happens when you confirm:",
      steps: [
        liveDrop
          ? `the current drop "${liveDrop.title}" is closed now and saved under previous drops${liveDrop.paidOrders ? `, with its ${liveDrop.paidOrders} paid ${liveDrop.paidOrders === 1 ? "order" : "orders"}` : ""}.`
          : "there's no current drop to close.",
        "this future drop becomes the current drop, with its menu, photos, prices, spots, pickup details and schedule exactly as you saved them.",
        "its paid orders list starts empty.",
        dropDraft?.opens_at
          ? "customers see it from its open time, or right away if that time has passed."
          : "you haven't set an open time, so customers won't see it until you set one on the this drop tab.",
        "the future drop slot is empty again so you can plan another.",
      ],
      warning: liveDrop && ["open", "upcoming"].includes(dropPhase(liveDrop.schedule, now))
        ? `the current drop "${liveDrop.title}" is ${dropPhase(liveDrop.schedule, now) === "open" ? "still taking preorders" : "scheduled to go live"}. it will be replaced and customers will no longer be able to order from it.`
        : undefined,
      action: "make current",
      run: publishFutureDrop,
    },
    discard: {
      title: "discard the future drop?",
      body: "this deletes the planned drop and everything in it. the current drop isn't affected.",
      action: "discard",
      run: discardFutureDrop,
    },
  };

  const box = "rounded-md bg-secondary p-5 md:p-6";
  const field = "w-full rounded-sm border border-primary/15 bg-background px-3 py-2 font-mono text-[13px] text-primary";

  if (!isSupabaseConfigured) return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center font-mono text-[13px] text-primary">
      <p>admin setup is incomplete. Add the Supabase environment values before signing in.</p>
    </div>
  );

  if (!session) return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className={`${box} max-w-sm text-center`}>
        <h1 className="font-display text-3xl font-black tracking-brand text-primary">owner sign in.</h1>
        <button onClick={() => void signIn()} className="mt-6 w-full rounded-sm bg-primary px-5 py-3 font-mono text-[12px] text-primary-foreground">
          sign in with Google
        </button>
      </div>
    </div>
  );

  if (isAdmin === false) return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center font-mono text-[13px] text-primary">
      <div>
        <p>this account ({session.user.email}) doesn't have owner access yet.</p>
        <button className="mt-4 underline" onClick={() => void supabase.auth.signOut()}>sign out</button>
      </div>
    </div>
  );

  // Older order lines may lack item_id; fall back to matching by name.
  const sold = (item: Item) => orders.filter((order) => !order.is_test).reduce((sum, order) => sum + order.items
    .filter((line) => (line.item_id ? line.item_id === item.id : line.name === item.name))
    .reduce((n, line) => n + line.qty, 0), 0);
  const groupSold = (id: string) => items.filter((i) => i.group_id === id).reduce((n, i) => n + sold(i), 0);

  return (
    <div className="min-h-screen bg-background px-5 py-10 md:px-10">
      <div className="mx-auto max-w-[1000px] space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-4xl font-black tracking-brand text-primary">orders.</h1>
          <button className="font-mono text-[12px] text-primary underline" onClick={() => void supabase.auth.signOut()}>sign out</button>
        </div>

        <div role="tablist" aria-label="drops" className="flex gap-2 font-mono text-[12px]">
          {([["future", "future drop"], ["current", "this drop"], ["previous", "previous drops"]] as const).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => void switchTab(key)}
              className={`rounded-sm border border-primary px-4 py-2 ${tab === key ? "bg-primary text-primary-foreground" : "text-primary"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "previous" && <PreviousDrops />}

        {tab === "future" && !loading && !drop && (
          <section className={box}>
            <h2 className="font-display text-2xl font-black tracking-brand text-primary">future drop.</h2>
            <p className="mt-2 font-mono text-[12px] text-primary/70">no future drop planned yet. plan the next one here without touching the current drop, then make it current with one click.</p>
            <button onClick={() => void planFutureDrop()} className="mt-4 rounded-sm bg-primary px-4 py-2 font-mono text-[12px] text-primary-foreground">plan a future drop</button>
            {notice && <p role="status" className={`mt-3 font-mono text-[12px] ${notice.ok ? "text-primary/70" : "text-destructive"}`}>{notice.text}</p>}
          </section>
        )}

        {tab !== "previous" && drop && !!drop.is_draft === planning && (
          <section className={box}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-black tracking-brand text-primary">{planning ? "future drop." : "this drop."}</h2>
                <p className="font-mono text-[12px] text-primary/70">
                  {planning ? "planning only. customers can't see this until you make it the current drop." : `status: ${phaseLabel[dropPhase(drop, now)]}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {planning ? (<>
                  <button onClick={() => setConfirming("discard")} className="rounded-sm border border-primary px-4 py-2 font-mono text-[12px] text-primary">
                    discard future drop
                  </button>
                  <button onClick={() => setConfirming("publish")} disabled={dirty || saving} title={dirty ? "save your changes first" : undefined}
                    className="rounded-sm bg-primary px-4 py-2 font-mono text-[12px] text-primary-foreground disabled:opacity-40">
                    make current drop
                  </button>
                </>) : (<>
                  <button onClick={() => (drop.is_open ? setConfirming("close") : void setOpen(true))} className="rounded-sm border border-primary px-4 py-2 font-mono text-[12px] text-primary">
                    {drop.is_open ? "close now" : "reopen"}
                  </button>
                  <button onClick={() => setConfirming("next")} className="rounded-sm bg-primary px-4 py-2 font-mono text-[12px] text-primary-foreground">
                    start next drop
                  </button>
                </>)}
              </div>
            </div>
            {dropDraft && (<>
              <label className="mt-4 block font-mono text-[11px] text-primary/60">drop title (shown on the homepage)
                <input className={field} maxLength={80} value={dropDraft.title} onChange={(event) => editDrop({ title: event.target.value })} />
              </label>
              <p className="mt-4 font-mono text-[11px] text-primary/60">preorder window (your local time). the drop is hidden before it opens. after the closing time, preorders are disabled and the site says "preorders closed". leave closes empty to keep taking orders until you close them.</p>
              <div className="mt-1 grid gap-3 sm:grid-cols-2">
                <label className="font-mono text-[11px] text-primary/60">opens
                  <input type="datetime-local" className={field} value={dropDraft.opens_at} onChange={(event) => editDrop({ opens_at: event.target.value })} />
                </label>
                <label className="font-mono text-[11px] text-primary/60">closes
                  <input type="datetime-local" className={field} value={dropDraft.closes_at} onChange={(event) => editDrop({ closes_at: event.target.value })} />
                </label>
              </div>
              <p className="mt-4 font-mono text-[11px] text-primary/60">pickup details shown to customers</p>
              <div className="mt-1 grid gap-3 sm:grid-cols-3">
                <label className="font-mono text-[11px] text-primary/60">date
                  <input type="date" className={field} value={dropDraft.pickup_date} onChange={(event) => editDrop({ pickup_date: event.target.value })} />
                </label>
                <label className="font-mono text-[11px] text-primary/60">start
                  <input type="time" className={field} value={dropDraft.pickup_start} onChange={(event) => editDrop({ pickup_start: event.target.value })} />
                </label>
                <label className="font-mono text-[11px] text-primary/60">end
                  <input type="time" className={field} value={dropDraft.pickup_end} onChange={(event) => editDrop({ pickup_end: event.target.value })} />
                </label>
              </div>
              <label className="mt-3 block font-mono text-[11px] text-primary/60">location
                <input className={field} value={dropDraft.pickup_location} onChange={(event) => editDrop({ pickup_location: event.target.value })} />
              </label>
              <p className="mt-2 font-mono text-[12px] text-primary/70">
                preview: {pickupWhen({ ...drop, pickup_date: dropDraft.pickup_date || null, pickup_start: dropDraft.pickup_start || null, pickup_end: dropDraft.pickup_end || null })}
                {dropDraft.pickup_location ? ` · ${dropDraft.pickup_location}` : ""}
              </p>
            </>)}
            <p className="mt-6 font-mono text-[11px] text-primary/60">stock groups. items in a group share its spots, and all of them sell out together.</p>
            <ul className="mt-1 space-y-2">
              {groupRows.map((row) => {
                const group = row.id ? groups.find((g) => g.id === row.id) : undefined;
                const members = rows.filter((r) => r.draft.group === row.key).map((r) => r.draft.name.trim() || "new item");
                const label = row.draft.name.trim() || "new group";
                return (
                  <li key={row.key} className="rounded-md bg-background p-4">
                    <div className="grid grid-cols-[1fr_7rem] gap-2">
                      <label className="font-mono text-[11px] text-primary/60">group name
                        <input className={field} value={row.draft.name} maxLength={80} placeholder="e.g. croissants" onChange={(event) => editGroup(row.key, { name: event.target.value })} />
                      </label>
                      <label className="font-mono text-[11px] text-primary/60">total spots
                        <input type="number" min={0} inputMode="numeric" className={field} value={row.draft.total_qty} onChange={(event) => editGroup(row.key, { total_qty: event.target.value })} />
                      </label>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-primary/60">
                      <p>
                        {group ? (planning ? `${group.total_qty} spots` : `sold ${groupSold(group.id)} / ${group.total_qty}`) : "not saved yet"}
                        {" · "}{members.length ? members.join(", ") : "no items yet, pick this group on an item below"}
                      </p>
                      <button onClick={() => removeGroup(row.key)} aria-label={`remove group ${label}`} className="underline">remove group</button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <button onClick={addGroup} className="mt-2 w-full rounded-md border border-dashed border-primary/40 py-2 font-mono text-[12px] text-primary">
              + add stock group
            </button>
            <p className="mt-6 font-mono text-[11px] text-primary/60">menu items</p>
            <ul className="mt-1 space-y-3">
              {rows.map((row) => {
                const d = row.draft;
                const img = row.preview ? { src: row.preview } : itemImage(d.name, d.image_url);
                const item = row.id ? items.find((i) => i.id === row.id) : undefined;
                const label = d.name.trim() || "new item";
                const groupRow = d.group ? groupRows.find((g) => g.key === d.group) : undefined;
                const groupName = groupRow?.draft.name.trim() || "new group";
                return (
                  <li key={row.key} className="rounded-md bg-background p-4">
                    <div className="flex gap-4">
                      <div className="w-24 shrink-0">
                        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-sm bg-secondary">
                          <img src={img.src} alt="" className="h-full w-full object-cover" />
                        </div>
                        <label className="mt-2 block cursor-pointer text-center font-mono text-[11px] text-primary underline focus-within:outline focus-within:outline-2">
                          change photo
                          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label={`change photo for ${label}`}
                            onChange={(event) => { pickPhoto(row, event.target.files?.[0]); event.target.value = ""; }} />
                        </label>
                        {(row.file || d.image_url) && (
                          <button onClick={() => clearPhoto(row)} className="mt-1 block w-full text-center font-mono text-[11px] text-primary/60 underline">use default</button>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <label className="block font-mono text-[11px] text-primary/60">name
                          <input className={field} value={d.name} maxLength={80} placeholder="e.g. cardamom bun" onChange={(event) => editItem(row.key, { name: event.target.value })} />
                        </label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <label className="font-mono text-[11px] text-primary/60">price $
                            <input type="number" min={0} step="0.5" inputMode="decimal" className={`${field} disabled:opacity-40`} value={d.variants.length ? "" : d.price}
                              disabled={d.variants.length > 0} placeholder={d.variants.length ? "see variations" : undefined}
                              title={d.variants.length ? "this item is priced by its variations below" : undefined}
                              onChange={(event) => editItem(row.key, { price: event.target.value })} />
                          </label>
                          <label className="font-mono text-[11px] text-primary/60">total spots
                            <input type="number" min={0} inputMode="numeric" className={`${field} disabled:opacity-40`} disabled={!!groupRow}
                              title={groupRow ? `uses the ${groupName} group's spots` : undefined}
                              value={d.total_qty} onChange={(event) => editItem(row.key, { total_qty: event.target.value })} />
                          </label>
                          <label className="font-mono text-[11px] text-primary/60" title="customers can order fewer only when that's all that's left">min / order
                            <input type="number" min={1} inputMode="numeric" className={field} value={d.min_per_order} onChange={(event) => editItem(row.key, { min_per_order: event.target.value })} />
                          </label>
                          <label className="font-mono text-[11px] text-primary/60">max / order
                            <input type="number" min={1} inputMode="numeric" className={field} value={d.max_per_order} onChange={(event) => editItem(row.key, { max_per_order: event.target.value })} />
                          </label>
                        </div>
                        {groupRows.length > 0 && (
                          <label className="block font-mono text-[11px] text-primary/60">stock group
                            <select className={field} value={d.group} onChange={(event) => editItem(row.key, { group: event.target.value })}>
                              <option value="">none (own spots)</option>
                              {groupRows.map((g) => <option key={g.key} value={g.key}>{g.draft.name.trim() || "new group"}</option>)}
                            </select>
                          </label>
                        )}
                        <div>
                          <p className="font-mono text-[11px] text-primary/60" title="e.g. mini $8 and 8&quot;x8&quot; $24">
                            variations (optional). customers pick from a pop-up when they tap +, each with its own price. all variations share this item's spots.
                          </p>
                          {d.variants.length > 0 && (
                            <ul className="mt-1 space-y-2">
                              {d.variants.map((v, index) => (
                                <li key={v.id} className="grid grid-cols-[1fr_6rem_auto] items-end gap-2">
                                  <label className="font-mono text-[11px] text-primary/60">name
                                    <input className={field} value={v.label} maxLength={40} placeholder={index === 0 ? "e.g. mini" : 'e.g. 8"x8"'}
                                      aria-label={`variation ${index + 1} name for ${label}`}
                                      onChange={(event) => editVariant(row.key, v.id, { label: event.target.value })} />
                                  </label>
                                  <label className="font-mono text-[11px] text-primary/60">price $
                                    <input type="number" min={0} step="0.5" inputMode="decimal" className={field} value={v.price}
                                      aria-label={`variation ${index + 1} price for ${label}`}
                                      onChange={(event) => editVariant(row.key, v.id, { price: event.target.value })} />
                                  </label>
                                  <button onClick={() => removeVariant(row.key, v.id)} aria-label={`remove variation ${v.label.trim() || index + 1} from ${label}`}
                                    className="pb-2 font-mono text-[11px] text-destructive underline">remove</button>
                                </li>
                              ))}
                            </ul>
                          )}
                          {d.variants.length < MAX_VARIANTS && (
                            <button onClick={() => addVariant(row.key)} aria-label={`add variation to ${label}`}
                              className="mt-2 w-full rounded-md border border-dashed border-primary/40 py-1.5 font-mono text-[11px] text-primary">
                              + add variation
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          {item && !planning && (
                            <p className="font-mono text-[11px] text-primary/60">
                              {groupRow ? `sold ${sold(item)} · shares ${groupName} spots` : `sold ${sold(item)} / ${item.total_qty}`}
                            </p>
                          )}
                          <button onClick={() => row.id ? setConfirmingItem(row) : removeItem(row)} disabled={saving}
                            aria-label={`${row.id ? "delete" : "remove"} ${label}`}
                            className="font-mono text-[11px] text-destructive underline disabled:opacity-50">
                            {row.id ? "delete item" : "remove"}
                          </button>
                        </div>
                      </div>
                    </div>
                    <textarea rows={3} placeholder="description shown to customers" aria-label={`description for ${label}`} className={`${field} mt-3`}
                      value={d.description} onChange={(event) => editItem(row.key, { description: event.target.value })} />
                    <label className="mt-3 block font-mono text-[11px] text-primary/60">ingredients
                      <textarea rows={2} placeholder="comma separated, shown on the details page" aria-label={`ingredients for ${label}`} className={`${field} mt-1`}
                        value={d.ingredients} onChange={(event) => editItem(row.key, { ingredients: event.target.value })} />
                    </label>
                  </li>
                );
              })}
            </ul>
            <button onClick={addItem} className="mt-3 w-full rounded-md border border-dashed border-primary/40 py-3 font-mono text-[12px] text-primary">
              + add more items
            </button>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-primary/10 pt-4">
              {notice ? (
                <p role="status" className={`mr-auto font-mono text-[12px] ${notice.ok ? "text-primary/70" : "text-destructive"}`}>{notice.text}</p>
              ) : dirty && <p className="mr-auto font-mono text-[12px] text-primary/70">unsaved changes</p>}
              {dirty && <button onClick={discard} disabled={saving} className="font-mono text-[12px] text-primary underline disabled:opacity-50">discard</button>}
              <button onClick={() => void save()} disabled={!dirty || saving} className="rounded-sm bg-primary px-5 py-2 font-mono text-[12px] text-primary-foreground disabled:opacity-40">
                {saving ? "saving…" : "save changes"}
              </button>
            </div>
          </section>
        )}

        <AlertDialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
          {confirming && (
            <AlertDialogContent className="w-[calc(100%-2.5rem)] max-w-sm rounded-md border-primary/15 bg-background sm:rounded-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display text-2xl font-black tracking-brand text-primary">{confirmCopy[confirming].title}</AlertDialogTitle>
                <AlertDialogDescription className="font-mono text-[12px] text-primary/70">{confirmCopy[confirming].body}</AlertDialogDescription>
                {confirmCopy[confirming].warning && (
                  <p role="alert" className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 font-mono text-[12px] font-bold text-destructive">
                    warning: {confirmCopy[confirming].warning}
                  </p>
                )}
                {confirmCopy[confirming].steps && (
                  <ul className="list-disc space-y-1 pl-4 text-left font-mono text-[12px] text-primary/70">
                    {confirmCopy[confirming].steps!.map((step) => <li key={step}>{step}</li>)}
                  </ul>
                )}
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="rounded-sm border-primary font-mono text-[12px] text-primary">cancel</AlertDialogCancel>
                <AlertDialogAction className="rounded-sm font-mono text-[12px]" onClick={() => void confirmCopy[confirming].run()}>{confirmCopy[confirming].action}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          )}
        </AlertDialog>

        <AlertDialog open={!!confirmingItem} onOpenChange={(open) => !open && setConfirmingItem(null)}>
          {confirmingItem && (
            <AlertDialogContent className="w-[calc(100%-2.5rem)] max-w-sm rounded-md border-primary/15 bg-background sm:rounded-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display text-2xl font-black tracking-brand text-primary">delete {confirmingItem.draft.name.trim() || "this item"}?</AlertDialogTitle>
                <AlertDialogDescription className="font-mono text-[12px] text-primary/70">
                  this item will be removed from the menu when you save changes, and won't be copied to future drops. existing orders and stock reservations are kept. you can discard before saving to undo this.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="rounded-sm border-primary font-mono text-[12px] text-primary">cancel</AlertDialogCancel>
                <AlertDialogAction disabled={saving} className="rounded-sm bg-destructive font-mono text-[12px] text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => removeItem(confirmingItem)}>delete item</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          )}
        </AlertDialog>

        {tab === "current" && <section className={box}>
          <h2 className="font-display text-2xl font-black tracking-brand text-primary">paid orders ({orders.length}).</h2>
          {orders.length === 0 && <p className="mt-3 font-mono text-[13px] text-primary/60">no orders yet.</p>}
          <ul className="mt-3 divide-y divide-primary/10">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-start justify-between gap-3 py-3 font-mono text-[12px] text-primary">
                <div>
                  <p className="font-bold">{order.is_test && <span className="mr-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-normal">test</span>}{order.customer_name} · ${(order.total_cents / 100).toFixed(2)}{order.discount_percent ? ` (${order.discount_percent}% off · ${order.discount_code})` : ""}</p>
                  <p className="text-primary/70"><span className="normal-case">{[order.email, order.phone].filter(Boolean).join(" · ")}</span>{order.sms_opt_in ? " · opted in to phone updates" : ""}</p>
                  <p className="text-primary/70">{order.items.map((line) => `${line.qty}× ${line.name}`).join(", ")}</p>
                </div>
                {order.status === "picked_up" ? <span className="text-primary/50">picked up</span> : <button onClick={() => void markPicked(order.id)} className="underline">mark picked up</button>}
              </li>
            ))}
          </ul>
        </section>}
      </div>
    </div>
  );
}
