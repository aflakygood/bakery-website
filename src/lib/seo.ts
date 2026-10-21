import { useEffect } from "react";

export const SITE_URL = "https://www.aflakygood.com";
export const DEFAULT_TITLE = "a flaky good. — Maple Valley, WA microbakery · sourdough, croissants & focaccia";
export const DEFAULT_DESCRIPTION =
  "Maple Valley, WA home microbakery. Fresh croissants, pain au chocolat, long-ferment sourdough bread and focaccia, baked to order. Weekly online preorders with pickup for Covington, Black Diamond, Enumclaw, Ravensdale and nearby.";

type Meta = { title?: string; description?: string; path?: string; noindex?: boolean };

const setMeta = (selector: string, create: () => HTMLElement, attr: string, value: string) => {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) { el = create(); document.head.appendChild(el); }
  el.setAttribute(attr, value);
};
const metaTag = (key: "name" | "property", name: string) => () => {
  const el = document.createElement("meta");
  el.setAttribute(key, name);
  return el;
};

// Per-route head tags. Crawlers that run JavaScript (Google, Bing) pick these up; index.html carries the homepage defaults.
export function usePageMeta({ title = DEFAULT_TITLE, description = DEFAULT_DESCRIPTION, path = "/", noindex = false }: Meta = {}) {
  useEffect(() => {
    const url = `${SITE_URL}${path === "/" ? "/" : path}`;
    document.title = title;
    setMeta('meta[name="description"]', metaTag("name", "description"), "content", description);
    setMeta('meta[name="robots"]', metaTag("name", "robots"), "content", noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
    setMeta('link[rel="canonical"]', () => Object.assign(document.createElement("link"), { rel: "canonical" }), "href", url);
    setMeta('meta[property="og:title"]', metaTag("property", "og:title"), "content", title);
    setMeta('meta[property="og:description"]', metaTag("property", "og:description"), "content", description);
    setMeta('meta[property="og:url"]', metaTag("property", "og:url"), "content", url);
    setMeta('meta[name="twitter:title"]', metaTag("name", "twitter:title"), "content", title);
    setMeta('meta[name="twitter:description"]', metaTag("name", "twitter:description"), "content", description);
  }, [title, description, path, noindex]);
}
