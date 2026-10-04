import { useEffect, useState } from "react";
import { Menu, X, Instagram } from "lucide-react";
import logoIcon from "@/assets/logo-icon-v2.png";

const links = [
  { href: "#about", label: "about" },
  { href: "#preorder", label: "preorder" },
  { href: "#menu", label: "menu" },
  { href: "#order", label: "order" },
  { href: "#faq", label: "faq" },
  { href: "#contact", label: "contact" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-background/85 backdrop-blur-md shadow-[0_1px_0_hsl(var(--primary)/0.08)]" : "bg-transparent"
      }`}
    >
      <nav className="relative mx-auto flex max-w-[1400px] items-center justify-between px-5 py-4 md:px-10 md:py-5">
        <a href="#top" className="flex items-center gap-2 shrink-0" aria-label="a flaky good.">
          <img src={logoIcon} alt="a flaky good." className="h-11 w-11 md:h-12 md:w-12" />
        </a>

        <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-9 font-mono text-[12px] lowercase tracking-brand text-primary md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="relative transition-opacity hover:opacity-60">
                {l.label} <span className="opacity-50">.</span>
              </a>
            </li>
          ))}
        </ul>

        <a
          href="https://www.instagram.com/aflakygood/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          className="hidden text-primary transition-opacity hover:opacity-60 md:inline-flex"
        >
          <Instagram className="h-5 w-5" />
        </a>

        <button
          onClick={() => setOpen(!open)}
          aria-label="menu"
          className="p-2 text-primary md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden border-t border-primary/10 bg-background">
          <ul className="flex flex-col px-5 py-2 font-mono text-[14px] lowercase tracking-brand text-primary">
            {links.map((l) => (
              <li key={l.href} className="border-b border-primary/10 py-4">
                <a href={l.href} onClick={() => setOpen(false)}>{l.label} <span className="opacity-50">.</span></a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
