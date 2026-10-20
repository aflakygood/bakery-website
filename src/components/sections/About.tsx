import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import image20260427 from "@/assets/gallery/20260427_201323.jpg";
import image20260516 from "@/assets/gallery/20260516_145815.jpg";
import image9093 from "@/assets/gallery/IMGC9093.CR3.jpg";
import image9609 from "@/assets/gallery/IMGC9609.CR3.jpg";
import image9696 from "@/assets/gallery/IMGC9696.CR3.jpg";
import image0056 from "@/assets/gallery/IMGC0056_Original.jpg";
import image0241 from "@/assets/gallery/IMGC0241_Original.jpg";
import image0079 from "@/assets/gallery/IMGC0079_Original.jpg";
import image0090 from "@/assets/gallery/IMGC0090_Original.jpg";
import image9697 from "@/assets/gallery/IMGC9697.CR3.jpg";
import image0344 from "@/assets/gallery/IMGC0344_Original.jpg";
import image9854 from "@/assets/gallery/IMGC9854.CR3.jpg";
import image0306 from "@/assets/gallery/IMGC0306_Original.jpg";
import image9615 from "@/assets/gallery/IMGC9615.CR3.jpg";

const gallery = [
  { src: image20260427, alt: "A flaky good bakery creation" },
  { src: image20260516, alt: "A flaky good bakery creation" },
  { src: image9093, alt: "A flaky good bakery creation" },
  { src: image9609, alt: "A flaky good bakery creation" },
  { src: image9696, alt: "A flaky good bakery creation" },
  { src: image0056, alt: "A flaky good bakery creation" },
  { src: image0241, alt: "A flaky good bakery creation" },
  { src: image0079, alt: "A flaky good bakery creation" },
  { src: image0090, alt: "A flaky good bakery creation" },
  { src: image9697, alt: "A flaky good bakery creation" },
  { src: image0344, alt: "A flaky good bakery creation" },
  { src: image9854, alt: "A flaky good bakery creation" },
  { src: image0306, alt: "A flaky good bakery creation" },
  { src: image9615, alt: "A flaky good bakery creation" },
];

const pillars = [
  { t: "real ingredients.", d: "Made only with exclusively sourced ingredients — authentic, imported, highest quality French butter and flour." },
  { t: "crafted by hand.", d: "Each loaf and croissant is shaped, rolled, and baked by hand." },
  { t: "small batch baking.", d: "Baked to order and in small batches to focus on freshness, consistency, and quality." },
];

export default function About() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const kids = Array.from(el.children).slice(0, gallery.length) as HTMLElement[];
    const c = el.scrollLeft + el.clientWidth / 2;
    let best = 0, d = Infinity;
    kids.forEach((k, i) => { const m = Math.abs(k.offsetLeft + k.offsetWidth / 2 - c); if (m < d) { d = m; best = i; } });
    setActive(best);
  };
  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.max(el.clientWidth * 0.8, 260);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };
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
        <div ref={scrollerRef} onScroll={onScroll} className="touch-pan-x touch-pan-y no-scrollbar flex gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth px-6 pb-2 md:gap-6 md:px-10" style={{ scrollSnapType: "x mandatory" }}>
          {gallery.map((g, i) => (
            <motion.figure
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.7, delay: i * 0.05 }}
              className="shrink-0"
              style={{ scrollSnapAlign: "center" }}
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

      <div className="mx-auto mt-16 max-w-[1100px] px-6 md:mt-[89.6px] md:px-10">
        <div className="grid gap-8 md:grid-cols-3 md:gap-x-10">
          {pillars.map((p, i) => (
            <motion.div
              key={p.t}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: i * 0.08 }}
              className="border-t border-primary/15 pt-5 first:border-t-0"
            >
              <h3 className="font-display text-lg font-black tracking-brand text-primary md:text-xl">{p.t}</h3>
              <p className="mt-2 font-mono text-[15px] leading-relaxed text-primary/75 md:text-[16px]">{p.d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
