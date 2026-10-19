import { useEffect, useState } from "react";
import { Instagram } from "lucide-react";
import logoIcon from "@/assets/logo-icon-v2.png";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const icon = "inline-flex text-primary transition-opacity hover:opacity-60";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-background/85 backdrop-blur-md shadow-[0_1px_0_hsl(var(--primary)/0.08)]" : "bg-transparent"
      }`}
    >
      <nav className="relative mx-auto flex max-w-[1400px] items-center justify-between px-5 py-4 md:px-10 md:py-5">
        <a href="#top" className="flex shrink-0 items-center gap-2" aria-label="a flaky good.">
          <img src={logoIcon} alt="a flaky good." className="h-11 w-11 md:h-12 md:w-12" />
        </a>
        <div className="flex items-center gap-5">
          <a href="https://www.instagram.com/aflakygood/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={icon}>
            <Instagram className="h-5 w-5" />
          </a>
        </div>
      </nav>
    </header>
  );
}
