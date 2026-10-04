import { motion } from "framer-motion";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const gallery = [
  { src: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=1200&q=80&auto=format&fit=crop", alt: "Golden croissants on parchment" },
  { src: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1200&q=80&auto=format&fit=crop", alt: "Sourdough loaf with crackled crust" },
  { src: "https://images.unsplash.com/photo-1568471173242-461f0a730452?w=1200&q=80&auto=format&fit=crop", alt: "Pain au chocolat fresh from the oven" },
  { src: "https://images.unsplash.com/photo-1568254183919-78a4f43a2877?w=1200&q=80&auto=format&fit=crop", alt: "Laminated dough hand-folded" },
  { src: "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=1200&q=80&auto=format&fit=crop", alt: "Sliced sourdough crumb" },
  { src: "https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=1200&q=80&auto=format&fit=crop", alt: "Pastry case display" },
  { src: "https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?w=1200&q=80&auto=format&fit=crop", alt: "Butter being folded into dough" },
];

const pillars = [
  { t: "real ingredients.", d: "Made only with exclusively sourced ingredients — authentic, imported, highest quality French butter and flour." },
  { t: "crafted by hand.", d: "Each loaf and croissant is shaped, rolled, and baked by hand." },
  { t: "small batch baking.", d: "Baked to order and in small batches to focus on freshness, consistency, and quality." },
];

export default function About() {
  const scrollerRef = useRef<HTMLDivElement>(null);
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
          className="mx-auto max-w-3xl text-center"
        >
          <p className="mt-6 font-mono text-[15px] leading-relaxed text-primary md:text-[17px]">
            a flaky good is a home microbakery in Maple Valley, built around small batch laminated pastries, long-ferment sourdough breads, and seasonal bakes — made with warmth, intention, and a lot of obsession.
          </p>
          <p className="mx-auto mt-5 max-w-xl font-mono text-[13px] leading-relaxed text-primary/70 md:text-[14px]">
            everything is baked fresh and available through weekly pre-orders and select bake drops.
          </p>
        </motion.div>
      </div>

      {/* Photo gallery — single row, horizontal scroll */}
      <div className="relative mt-14 md:mt-20">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 items-center justify-between px-3 md:px-6">
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
        <div ref={scrollerRef} className="no-scrollbar flex gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth px-6 pb-2 md:gap-6 md:px-10" style={{ scrollSnapType: "x mandatory" }}>
          {gallery.map((g, i) => (
            <motion.figure
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.7, delay: i * 0.05 }}
              className="shrink-0"
              style={{ scrollSnapAlign: "start" }}
            >
              <img
                src={g.src}
                alt={g.alt}
                loading="lazy"
                className="h-[280px] w-[230px] rounded-[6px] object-cover md:h-[420px] md:w-[340px]"
              />
            </motion.figure>
          ))}
          <div className="shrink-0 w-2" aria-hidden />
        </div>
      </div>

      <div className="mx-auto mt-20 max-w-[1100px] px-6 md:mt-28 md:px-10">
        <div className="grid gap-8 md:grid-cols-3 md:gap-x-10">
          {pillars.map((p, i) => (
            <motion.div
              key={p.t}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: i * 0.08 }}
              className="border-t border-primary/15 pt-5"
            >
              <h3 className="font-display text-lg font-black tracking-brand text-primary md:text-xl">{p.t}</h3>
              <p className="mt-2 font-mono text-[12px] leading-relaxed text-primary/75 md:text-[13px]">{p.d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}