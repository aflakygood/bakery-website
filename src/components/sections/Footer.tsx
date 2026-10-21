import logoIcon from "@/assets/logo-icon.png";
import { Instagram } from "lucide-react";
import { Link } from "react-router-dom";

const contactButton =
  "inline-flex items-center gap-4 rounded-[6px] bg-secondary px-5 py-4 font-mono text-sm tracking-brand text-primary transition-colors hover:bg-accent";

// lucide has no brand icons, so this is the WhatsApp glyph drawn as a stroke icon to match the Instagram one.
const WhatsApp = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
    <path d="M3 21l1.65-4.8A9 9 0 1 1 8 19.5L3 21z" />
    <path d="M9 10c0 3 2 5 5 5l1.2-1.4a.6.6 0 0 0-.1-.9l-1.5-.8a.6.6 0 0 0-.7.1l-.4.4c-.9-.4-1.6-1.1-2-2l.4-.4a.6.6 0 0 0 .1-.7l-.8-1.5a.6.6 0 0 0-.9-.1L9 10z" />
  </svg>
);

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
                preorders, weekly drops, and pickup details — all live on instagram and whatsapp.
              </p>
              <div className="mt-8 flex flex-col items-start gap-3">
                <a
                  href="https://www.instagram.com/aflakygood/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={contactButton}
                >
                  <Instagram className="h-5 w-5" />
                  @aflakygood
                </a>
                <a
                  href="https://chat.whatsapp.com/JyekSKH1fs2D863sNHgo9Q"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={contactButton}
                >
                  <WhatsApp className="h-5 w-5" />
                  join whatsapp group
                </a>
              </div>
            </div>
          )}
          <div className={`flex flex-col items-center justify-between gap-4 md:flex-row ${showContact ? "pt-6" : ""}`}>
            <img src={logoIcon} alt="a flaky good." className="h-9 w-9" />
            <div className="flex flex-col items-center gap-2 md:flex-row md:gap-5">
              <nav aria-label="legal" className="flex gap-4 font-mono text-[11px] tracking-brand text-primary/70">
                <Link to="/terms" className="underline-offset-2 hover:underline">terms</Link>
                <Link to="/privacy" className="underline-offset-2 hover:underline">privacy</Link>
              </nav>
              <p className="font-mono text-[10px] lowercase tracking-brand text-primary/55">
                © {new Date().getFullYear()} a flaky good. — Maple Valley, WA
              </p>
            </div>
          </div>
        </div>

        <div className="h-10 md:h-16" />
      </div>
    </footer>
  );
}
