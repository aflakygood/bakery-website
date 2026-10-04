import { motion } from "framer-motion";

const items = [
  {
    name: "classic croissant.",
    note: "72-hr cold-laminated, French butter",
    img: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=900&q=80&auto=format&fit=crop",
  },
  {
    name: "pain au chocolat.",
    note: "two batons of single-origin dark chocolate",
    img: "https://images.unsplash.com/photo-1623334044303-241021148842?w=900&q=80&auto=format&fit=crop",
  },
  {
    name: "kouign-amann.",
    note: "caramelized sugar, sea salt finish",
    img: "https://images.unsplash.com/photo-1612203985729-70726954388c?w=900&q=80&auto=format&fit=crop",
  },
  {
    name: "country sourdough.",
    note: "48-hr ferment, heritage flours",
    img: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=900&q=80&auto=format&fit=crop",
  },
  {
    name: "seeded rye.",
    note: "toasted sesame, fennel, caraway",
    img: "https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=900&q=80&auto=format&fit=crop",
  },
  {
    name: "cardamom bun.",
    note: "hand-twisted, brown butter glaze",
    img: "https://images.unsplash.com/photo-1568051243851-f9b136146e97?w=900&q=80&auto=format&fit=crop",
  },
];

export default function Menu() {
  return (
    <section id="menu" className="relative pb-[40px] pt-[25px] md:pb-[88px] md:pt-[73px]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <div className="flex flex-col items-center text-center">
          <h2 className="mt-4 font-display text-4xl font-black tracking-brand text-primary md:text-6xl">
            the menu.
          </h2>
          <p className="mt-5 max-w-md font-mono text-[13px] leading-relaxed text-primary/70">
            menu rotates with the seasons. drops are announced weekly via Instagram.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-4 md:mt-20 md:grid-cols-3 md:gap-6">
          {items.map((it, i) => (
            <motion.article
              key={it.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.07 }}
              className="group"
            >
              <div className="aspect-[4/5] overflow-hidden rounded-[6px] bg-secondary/60">
                <img
                  src={it.img}
                  alt={it.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <h3 className="mt-3 font-display text-base font-black tracking-brand text-primary md:text-lg">{it.name}</h3>
              <p className="mt-1 font-mono text-[11px] leading-snug text-primary/65 md:text-[12px]">{it.note}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}