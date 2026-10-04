import { Instagram, ArrowUpRight } from "lucide-react";
import logoIcon from "@/assets/logo-icon.png.asset.json";

export default function Footer() {
  return (
    <footer id="contact" className="relative bg-stripes pt-10 md:pt-16">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <div className="rounded-md bg-background/95 p-8 backdrop-blur-sm md:p-14">
          <div className="grid gap-10 md:grid-cols-2 md:gap-16">
            <div>
              <h2 className="mt-4 font-display text-4xl font-black leading-[0.95] tracking-brand text-primary md:text-6xl">
                say hello.<br />drop a DM.
              </h2>
              <p className="mt-6 max-w-sm font-mono text-[13px] leading-relaxed text-primary/75">
                pre-orders, weekly drops, allergen info and pickup details — all live on Instagram.
              </p>
              <a
                href="https://instagram.com/"
                target="_blank"
                rel="noreferrer"
                className="group mt-8 inline-flex items-center gap-3 rounded-sm border border-primary/30 px-5 py-3.5 font-mono text-[12px] lowercase tracking-brand text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <Instagram className="h-4 w-4" />
                <span>@aflakygood</span>
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            </div>

            <div className="grid grid-cols-2 gap-y-8 self-end">
              {[
                ["location.", "Maple Valley, WA"],
                ["payment.", "Zelle"],
                ["drops.", "weekly"],
                ["pickup.", "by appointment"],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="font-mono text-[10px] lowercase tracking-brand text-primary/55">{k}</p>
                  <p className="mt-2 font-display text-base font-black tracking-brand text-primary md:text-lg">{v}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-primary/15 pt-8 md:flex-row">
            <div className="flex items-center gap-3">
              <img src={logoIcon.url} alt="a flaky good." className="h-9 w-9" />
              <span className="font-display text-sm font-black tracking-brand text-primary">a flaky good.</span>
            </div>
            <p className="font-mono text-[10px] lowercase tracking-brand text-primary/55">
              © {new Date().getFullYear()} a flaky good. — Maple Valley, WA
            </p>
          </div>
        </div>

        <div className="h-10 md:h-16" />
      </div>
    </footer>
  );
}