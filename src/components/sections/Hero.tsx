import { motion } from "framer-motion";
import wordmark from "@/assets/logo-wordmark.png";

export default function Hero() {
  return (
    <section id="top" className="relative w-full overflow-hidden bg-background pt-[76px] md:pt-[84px]">
      <div className="bg-stripes">
        <div className="relative mx-auto flex min-h-[55svh] max-w-[1400px] items-center justify-center px-6 py-12 md:py-16">
          <motion.img
            src={wordmark}
            alt="a flaky good. — boulangerie · patisserie"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[344px] object-contain drop-shadow-[0_1px_0_hsl(var(--background))]"
          />
        </div>
      </div>
    </section>
  );
}
