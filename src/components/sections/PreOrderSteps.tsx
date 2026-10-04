import { motion } from "framer-motion";

const steps = [
  {
    n: "01",
    title: "weekly drop.",
    lines: [
      "drops typically happen every week.",
      "pre-orders open a few days prior to the pick-up date.",
      "upcoming bake dates are announced on Instagram.",
    ],
  },
  {
    n: "02",
    title: "place your order.",
    lines: [
      "when pre-orders open, pick from the menu and drop a DM with your order details.",
      "orders are secured once Zelle payment is processed.",
      "preorder spots are limited and close once capacity is reached.",
    ],
  },
  {
    n: "03",
    title: "pickup in Maple Valley.",
    lines: [
      "every bake is prepared fresh for pickup day.",
      "confirmation and pickup details are provided via DM once your order is in.",
    ],
  },
];

export default function PreOrderSteps() {
  return (
    <section id="preorder" className="relative bg-secondary pb-20 pt-10 md:pb-32 md:pt-14">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <div className="text-center">
          <h2 className="font-display text-4xl font-black tracking-brand text-primary md:text-6xl">
            how to pre-order.
          </h2>
        </div>

        <div className="mt-14 grid gap-10 md:mt-20 md:gap-8">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="relative rounded-[6px] bg-background px-7 py-4 md:px-8 md:py-4"
            >
              <p className="font-mono text-[12px] tracking-brand text-primary/60">{s.n} —</p>
              <h3 className="mt-1 font-display text-2xl font-black tracking-brand text-primary md:text-[28px]">
                {s.title}
              </h3>
              <div className="mt-2 space-y-1 font-mono text-[13px] leading-snug text-primary/75">
                {s.lines.map((l, k) => <p key={k}>{l}</p>)}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}