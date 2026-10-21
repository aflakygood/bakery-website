import logoIcon from "@/assets/logo-icon.png";
import { Instagram } from "lucide-react";
import { Link } from "react-router-dom";

const contactButton =
  "inline-flex items-center gap-4 rounded-[6px] bg-secondary px-5 py-4 font-mono text-sm tracking-brand text-primary transition-colors hover:bg-accent";

// lucide has no brand icons; this is the solid WhatsApp glyph (Simple Icons, CC0) with the handset cut out.
const WhatsApp = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden="true" className={className}>
    <path d="M20.463 3.488A11.815 11.815 0 0 0 12.05 0C5.495 0 0.16 5.335 0.157 11.892 0.157 13.988 0.704 16.034 1.745 17.837L0.057 24 6.362 22.346A11.882 11.882 0 0 0 12.045 23.794H12.05C18.604 23.794 23.94 18.459 23.943 11.901A11.821 11.821 0 0 0 20.463 3.488Z M17.472 14.382C17.175 14.233 15.714 13.515 15.442 13.415 15.169 13.316 14.971 13.267 14.772 13.565 14.575 13.862 14.005 14.531 13.832 14.729 13.659 14.928 13.485 14.952 13.188 14.804 12.891 14.654 11.933 14.341 10.798 13.329 9.915 12.541 9.318 11.568 9.145 11.27 8.972 10.973 9.127 10.812 9.275 10.664 9.409 10.531 9.573 10.317 9.721 10.144 9.87 9.97 9.919 9.846 10.019 9.647 10.118 9.449 10.069 9.276 9.994 9.127 9.919 8.978 9.325 7.515 9.078 6.92 8.836 6.341 8.591 6.42 8.409 6.41 8.236 6.402 8.038 6.4 7.839 6.4 7.641 6.4 7.319 6.474 7.047 6.772 6.775 7.069 6.007 7.788 6.007 9.251 6.007 10.713 7.072 12.126 7.22 12.325 7.369 12.523 9.316 15.525 12.297 16.812 13.006 17.118 13.559 17.301 13.991 17.437 14.703 17.664 15.351 17.632 15.862 17.555 16.433 17.47 17.62 16.836 17.868 16.142 18.116 15.448 18.116 14.853 18.041 14.729 17.967 14.605 17.769 14.531 17.471 14.382Z" />
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
