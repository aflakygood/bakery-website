import logoIcon from "@/assets/logo-icon.png";
import { Instagram } from "lucide-react";
import { Link } from "react-router-dom";

const contactButton =
  "inline-flex items-center gap-4 rounded-[6px] bg-secondary px-5 py-4 font-mono text-sm tracking-brand text-primary transition-colors hover:bg-accent";

// lucide has no brand icons; this is the WhatsApp logo (Simple Icons, CC0), inset to the same 2px padding as the Instagram icon.
const WhatsApp = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" transform="translate(2 2) scale(.8333)" />
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
