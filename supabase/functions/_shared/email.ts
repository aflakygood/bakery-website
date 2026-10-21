import nodemailer from "npm:nodemailer@6.9.16";
import { formatPickupDate, pickupWhen, type PickupFields } from "./pickup.ts";

export type OrderEmail = {
  customer_name: string;
  items: { name: string; qty: number; price_cents: number }[];
  subtotal_cents: number;
  total_cents: number;
  discount_percent: number | null;
  pickup: PickupFields | null;
  pickup_address: string | null;
};

const GREEN = "#1f5133";
const CREAM = "#fffef3";
const LAVENDER = "#ebecf5";
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
// Names and item names come from customers/admins, so everything is escaped before going into HTML.
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export function orderEmail(o: OrderEmail) {
  const name = o.customer_name.trim();
  const when = o.pickup ? pickupWhen(o.pickup).replace(/\u00a0/g, " ").toLowerCase() : "";
  const where = o.pickup_address ?? o.pickup?.pickup_location ?? "";
  const date = o.pickup?.pickup_date ? formatPickupDate(o.pickup.pickup_date).toLowerCase() : "";
  const subject = date ? `you're in! pickup ${date} · a flaky good.` : "you're in! · a flaky good.";
  const discount = o.discount_percent ? o.subtotal_cents - o.total_cents : 0;

  const text = [
    `you're in${name ? ` ${name}` : ""}.`,
    "thank you for your order.",
    "",
    "PICKUP DETAILS",
    when, where,
    "",
    "YOUR ORDER",
    ...o.items.map((i) => `${i.qty} x ${i.name}  ${money(i.qty * i.price_cents)}`),
    ...(discount ? [`subtotal  ${money(o.subtotal_cents)}`, `${o.discount_percent}% discount  -${money(discount)}`] : []),
    `total paid  ${money(o.total_cents)}`,
    "",
    "questions? just reply to this email.",
    "a flaky good. · Maple Valley, WA · instagram.com/aflakygood",
  ].filter((l) => l !== undefined).join("\n");

  const row = (left: string, right: string, style = "") =>
    `<tr><td style="padding:10px 0;${style}">${left}</td><td align="right" style="padding:10px 0;white-space:nowrap;${style}">${right}</td></tr>`;
  const lines = o.items.map((i) =>
    row(`${i.qty} &times; ${esc(i.name)}`, money(i.qty * i.price_cents), "border-bottom:1px solid #e4e6dc;")).join("");
  const totals = [
    ...(discount ? [row("subtotal", money(o.subtotal_cents), "color:#5b7a66;"), row(`${o.discount_percent}% discount`, `&minus;${money(discount)}`, "color:#5b7a66;")] : []),
    row("<strong>total paid</strong>", `<strong>${money(o.total_cents)}</strong>`),
  ].join("");

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:${CREAM};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:${FONT};color:${GREEN};">
  <tr><td style="font-size:30px;font-weight:900;letter-spacing:-0.5px;padding-bottom:6px;">you're in${name ? ` ${esc(name)}` : ""}.</td></tr>
  <tr><td style="font-size:16px;color:#4a6b55;padding-bottom:28px;">thank you for your order.</td></tr>
  <tr><td style="background:${LAVENDER};border-radius:6px;padding:20px 22px;">
    <div style="font-size:18px;font-weight:900;padding-bottom:10px;">pickup details</div>
    ${when ? `<div style="font-size:15px;padding:3px 0;">&#128197;&nbsp; ${esc(when)}</div>` : ""}
    ${where ? `<div style="font-size:15px;padding:3px 0;">&#128205;&nbsp; ${esc(where)}</div>` : ""}
  </td></tr>
  <tr><td style="height:16px;"></td></tr>
  <tr><td style="border:1px solid #dfe3d6;border-radius:6px;padding:20px 22px;">
    <div style="font-size:18px;font-weight:900;padding-bottom:4px;">your order</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;color:${GREEN};">${lines}${totals}</table>
  </td></tr>
  <tr><td style="font-size:13px;color:#5b7a66;padding-top:24px;line-height:1.6;">
    questions? just reply to this email.<br>
    a flaky good. &middot; Maple Valley, WA &middot; <a href="https://www.instagram.com/aflakygood/" style="color:${GREEN};">@aflakygood</a>
  </td></tr>
</table></td></tr></table></body></html>`;

  return { subject, text, html };
}

// Sends through Gmail SMTP (port 465 — Supabase blocks 25/587). Returns false instead of throwing
// so a mail hiccup never breaks an already-paid order confirmation.
export async function sendOrderEmail(to: string, o: OrderEmail) {
  const user = Deno.env.get("GMAIL_USER");
  const pass = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!user || !pass || !to) {
    console.warn("order email skipped: missing GMAIL_USER/GMAIL_APP_PASSWORD or recipient");
    return false;
  }
  try {
    const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
    const { subject, text, html } = orderEmail(o);
    await transport.sendMail({ from: `"a flaky good." <${user}>`, to, subject, text, html });
    return true;
  } catch (e) {
    console.error("order email failed", e);
    return false;
  }
}
