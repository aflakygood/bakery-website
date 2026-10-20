import logoIcon from "@/assets/logo-icon.png";
import { Instagram, ArrowUpRight } from "lucide-react";

export default function Footer({ showContact = false }: { showContact?: boolean }) {
  return (
    <footer id="contact" className="relative bg-stripes pt-10 md:pt-16">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <div className="rounded-md bg-background/95 p-6 backdrop-blur-sm md:p-8">
          {showContact && (
            <div className="border-b border-primary/15 pb-10 pt-8 md:pb-14 md:pt-12">
              <h2 className="font-display text-5xl font-black leading-[0.95] tracking-brand text-primary md:text-7xl">
                say hello.
                <br />
                drop a dm.
              </h2>
              <p className="mt-6 max-w-md font-mono text-[15px] leading-relaxed tracking-brand text-primary/70">
                preorders, weekly drops, and pickup details — all live on instagram.
              </p>
              <a
                href="https://www.instagram.com/aflakygood/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center gap-4 border border-primary/30 px-5 py-4 font-mono text-sm tracking-brand text-primary transition-colors hover:bg-secondary"
              >
                <Instagram className="h-5 w-5" />
                @aflakygood
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          )}
          <div className={`flex flex-col items-center justify-between gap-4 md:flex-row ${showContact ? "pt-6" : ""}`}>
            <div className="flex items-center gap-3">
              <img src={logoIcon} alt="a flaky good." className="h-9 w-9" />
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
