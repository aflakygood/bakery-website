import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Gallery photos, shown in filename order.
const photos = import.meta.glob<string>("@/assets/gallery/*.webp", { eager: true, import: "default" });
const alts: Record<string, string> = {
  "01-croissant": "croissant",
  "02-corn-cheese-focaccia": "corn and cheese focaccia",
  "03-basil-pesto-danish": "basil pesto danish",
  "04-sourdough": "sourdough bread",
  "05-eggless-fruit-tart": "eggless fruit tart",
  "06-croissants": "croissants",
  "07-mushroom-onion-focaccia": "mushroom and onion focaccia",
  "08-danishes": "danishes",
  "09-croissant": "croissant",
  "10-corn-olive-focaccia": "corn and olive focaccia",
  "11-sourdough": "sourdough bread",
  "12-pain-au-chocolat": "pain au chocolat",
  "13-olive-corn-focaccia": "olive and corn focaccia",
  "14-tiramisu-danish": "tiramisu danish",
  "15-multigrain-sourdough": "multigrain sourdough",
};
const gallery = Object.keys(photos).sort().map((path) => {
  const name = path.split("/").pop()!.replace(/\.webp$/, "");
  return { src: photos[path], alt: `${alts[name] ?? "bake"} — baked fresh by a flaky good., maple valley, wa` };
});

const pillars = [
  { t: "real ingredients.", d: "Made only with exclusively sourced ingredients — authentic, imported, highest quality French butter and flour." },
  { t: "crafted by hand.", d: "Each loaf and croissant is shaped, rolled, and baked by hand." },
  { t: "small batch baking.", d: "Baked to order and in small batches to focus on freshness, consistency, and quality." },
];

const AUTO_SCROLL_MS = 3000;
const SLIDE_MS = 900;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const RESUME_AFTER_INTERACTION_MS = 5000;
// Rendered twice so auto-scroll can loop seamlessly: once a full set has
// scrolled past, we jump back by exactly one set width (visually identical).
const loopGallery = [...gallery, ...gallery];

const figures = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLElement>(":scope > figure"));
const setWidth = (kids: HTMLElement[]) => kids[gallery.length].offsetLeft - kids[0].offsetLeft;
const centerOf = (el: HTMLElement, k: HTMLElement) => k.offsetLeft + k.offsetWidth / 2 - el.clientWidth / 2;
const nearestIndex = (el: HTMLElement, kids: HTMLElement[]) => {
  let best = 0, d = Infinity;
  kids.forEach((k, i) => { const m = Math.abs(centerOf(el, k) - el.scrollLeft); if (m < d) { d = m; best = i; } });
  return best;
};
// Jump (invisibly) between the two identical sets so there's always room to scroll in `dir`.
const wrap = (el: HTMLElement, kids: HTMLElement[], dir: 1 | -1, amount: number) => {
  const span = setWidth(kids);
  if (dir === 1 && el.scrollLeft >= span) el.scrollTo({ left: el.scrollLeft - span, behavior: "instant" });
  else if (dir === -1 && el.scrollLeft < amount) el.scrollTo({ left: el.scrollLeft + span, behavior: "instant" });
};

export default function About() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const reduceMotion = useReducedMotion();
  const hovering = useRef(false);
  const inView = useRef(false);
  const resumeAt = useRef(0);
  const slide = useRef(0);
  const stopSlide = () => {
    if (!slide.current) return;
    cancelAnimationFrame(slide.current);
    slide.current = 0;
    if (scrollerRef.current) scrollerRef.current.style.scrollSnapType = "x mandatory";
  };
  // Eased slide; scroll snapping is paused while it runs so it doesn't fight the animation.
  const slideTo = (el: HTMLElement, target: number) => {
    stopSlide();
    const from = el.scrollLeft;
    const to = Math.max(0, Math.min(target, el.scrollWidth - el.clientWidth));
    if (reduceMotion || Math.abs(to - from) < 1) return el.scrollTo({ left: to, behavior: "instant" });
    el.style.scrollSnapType = "none";
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / SLIDE_MS);
      el.scrollTo({ left: from + (to - from) * easeInOutCubic(t), behavior: "instant" });
      if (t < 1) slide.current = requestAnimationFrame(step);
      else { slide.current = 0; el.style.scrollSnapType = "x mandatory"; }
    };
    slide.current = requestAnimationFrame(step);
  };
  const pauseForInteraction = () => { resumeAt.current = Date.now() + RESUME_AFTER_INTERACTION_MS; };
  const onUserScroll = () => { stopSlide(); pauseForInteraction(); };

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setActive(nearestIndex(el, figures(el)) % gallery.length);
  };
  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    pauseForInteraction();
    stopSlide();
    const kids = figures(el);
    const amount = Math.max(el.clientWidth * 0.8, 260);
    const pitch = kids[1].offsetLeft - kids[0].offsetLeft;
    const steps = Math.max(1, Math.round(amount / pitch));
    wrap(el, kids, dir, amount);
    const target = kids[Math.max(0, Math.min(kids.length - 1, nearestIndex(el, kids) + dir * steps))];
    slideTo(el, centerOf(el, target));
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || reduceMotion) return;
    const io = new IntersectionObserver(([e]) => { inView.current = e.isIntersecting; });
    io.observe(el);
    const id = window.setInterval(() => {
      if (hovering.current || !inView.current || document.hidden || Date.now() < resumeAt.current) return;
      const kids = figures(el);
      wrap(el, kids, 1, 0);
      const next = kids[nearestIndex(el, kids) + 1];
      if (next) slideTo(el, centerOf(el, next));
    }, AUTO_SCROLL_MS);
    return () => { window.clearInterval(id); io.disconnect(); stopSlide(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- slideTo/stopSlide only touch refs
  }, [reduceMotion]);
  return (
    <section id="about" className="relative pb-20 pt-[50px] md:pb-32 md:pt-[98px]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-3xl py-[100px] text-center"
        >
          <p className="mt-6 font-mono text-[20px] leading-relaxed tracking-brand text-primary md:text-[23px]">
            a flaky good is a home microbakery in maple valley - washington, built around small batch laminated pastries, long-ferment sourdough breads, and seasonal bakes — made with warmth, intention, and a lot of obsession.
          </p>
        </motion.div>
      </div>

      {/* Photo gallery — single row, horizontal scroll */}
      <div className="relative mt-14 md:mt-20">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 hidden md:flex -translate-y-1/2 items-center justify-between px-3 md:px-6">
          <button
            type="button"
            aria-label="previous"
            onClick={() => scrollBy(-1)}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-background/70 text-primary backdrop-blur-md ring-1 ring-primary/15 transition hover:bg-background/90 md:h-12 md:w-12"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="next"
            onClick={() => scrollBy(1)}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-background/70 text-primary backdrop-blur-md ring-1 ring-primary/15 transition hover:bg-background/90 md:h-12 md:w-12"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          onPointerEnter={(e) => { if (e.pointerType === "mouse") hovering.current = true; }}
          onPointerLeave={() => { hovering.current = false; }}
          onPointerDown={onUserScroll}
          onTouchStart={onUserScroll}
          onWheel={onUserScroll}
          className="relative touch-pan-x touch-pan-y no-scrollbar flex gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain px-6 pb-2 md:gap-6 md:px-10"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {loopGallery.map((g, i) => (
            <motion.figure
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.7, delay: (i % gallery.length) * 0.05 }}
              className="shrink-0"
              style={{ scrollSnapAlign: "center" }}
              aria-hidden={i >= gallery.length || undefined}
            >
              <img
                src={g.src}
                alt={g.alt}
                loading="lazy"
                className="h-[80svh] w-[90vw] rounded-[6px] object-cover md:h-[420px] md:w-[340px]"
              />
            </motion.figure>
          ))}
          <div className="shrink-0 w-2" aria-hidden />
        </div>
        <div className="mt-4 flex items-center justify-center gap-1.5 md:hidden" aria-hidden>
          {gallery.map((_, i) => (
            <span key={i} className={`rounded-full bg-primary transition-all ${i === active ? "h-1.5 w-1.5 opacity-100" : Math.abs(i - active) > 3 ? "h-1 w-1 opacity-20" : "h-1.5 w-1.5 opacity-30"}`} />
          ))}
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-[1100px] px-6 py-[25px] md:mt-[89.6px] md:px-10">
        <div className="grid gap-8 md:grid-cols-3 md:gap-x-10">
          {pillars.map((p, i) => (
            <motion.div
              key={p.t}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: i * 0.08 }}
              className="border-t border-primary/15 pt-5 first:border-t-0 md:first:border-t"
            >
              <h3 className="font-display text-[20px] font-black tracking-brand text-primary md:text-[22px]">{p.t}</h3>
              <p className="mt-2 font-mono text-[17px] leading-normal text-primary/75 md:text-[18px]">{p.d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
