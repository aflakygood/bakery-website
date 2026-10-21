import { motion } from "framer-motion";

const bakes = [
  "sourdough bread",
  "multigrain sourdough",
  "olive & rosemary focaccia",
  "corn jalapeño & cheese focaccia",
  "croissants",
  "pain au chocolat",
  "danishes",
  "eggless fruit tarts",
  "seasonal bakes",
];

const towns = ["covington", "black diamond", "ravensdale", "enumclaw", "hobart", "kent", "auburn", "renton"];

export default function Local() {
  return (
    <section id="bakes" className="relative pb-20 md:pb-32">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-[900px] px-6 text-center md:px-10"
      >
        <h2 className="font-display text-4xl font-black tracking-brand text-primary md:text-6xl">
          baked in maple valley.
        </h2>
        <p className="mx-auto mt-6 max-w-2xl font-mono text-[15px] leading-relaxed text-primary/75 md:text-[17px]">
          your neighborhood microbakery in maple valley, wa. every bake is made by hand in small batches and baked fresh to order for local pickup —
          from neighbors in {towns.slice(0, -1).join(", ")} and {towns[towns.length - 1]}, and everywhere in between.
        </p>

        <h3 className="mt-12 font-display text-2xl font-black tracking-brand text-primary md:text-3xl">what we bake.</h3>
        <ul className="mt-5 flex flex-wrap justify-center gap-2.5">
          {bakes.map((b) => (
            <li key={b} className="rounded-full bg-secondary px-4 py-2 font-mono text-[13px] tracking-brand text-primary md:text-[14px]">
              {b}
            </li>
          ))}
        </ul>
        <p className="mx-auto mt-6 max-w-2xl font-mono text-[15px] leading-relaxed text-primary/75 md:text-[17px]">
          menus change every week, so follow the drop for what's fresh. need something for an event? we cater too, including an extended menu of eggless bakes.
        </p>
      </motion.div>
    </section>
  );
}
