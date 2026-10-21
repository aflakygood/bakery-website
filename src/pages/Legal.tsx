import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Footer from "@/components/sections/Footer";
import logoIcon from "@/assets/logo-icon-v2.png";
import { usePageMeta } from "@/lib/seo";

const CONTACT = "aflakygood@gmail.com";
const UPDATED = "October 20, 2026";

const mail = <a href={`mailto:${CONTACT}`} className="underline underline-offset-2">{CONTACT}</a>;

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-primary/10 pt-6">
      <h2 className="font-display text-2xl font-black tracking-brand text-primary md:text-3xl">{title}</h2>
      <div className="mt-3 space-y-3 font-mono text-[15px] leading-relaxed text-primary/80 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}

function LegalPage({ title, path, children }: { title: string; path: string; children: ReactNode }) {
  usePageMeta({ title: `${title} · a flaky good. Maple Valley, WA`, description: `${title} for a flaky good., a licensed microbakery in Maple Valley, WA.`, path });
  useEffect(() => {
    const target = window.location.hash && document.getElementById(window.location.hash.slice(1));
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [title]);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto grid max-w-[1100px] grid-cols-[1fr_auto_1fr] items-center px-6 py-4 md:px-10">
        <Link to="/" aria-label="home" className="inline-flex justify-self-start p-1 text-primary hover:opacity-60">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <Link to="/" aria-label="a flaky good."><img src={logoIcon} alt="a flaky good." className="h-11 w-11" /></Link>
      </header>
      <main className="mx-auto max-w-[760px] px-6 pb-16 pt-6 md:px-10 md:pt-10">
        <h1 className="font-display text-5xl font-black leading-[0.95] tracking-brand text-primary md:text-6xl">{title}.</h1>
        <p className="mt-4 font-mono text-[12px] text-primary/55">last updated {UPDATED}</p>
        <div className="mt-8 space-y-8">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

export function Terms() {
  return (
    <LegalPage title="terms" path="/terms">
      <p className="font-mono text-[15px] leading-relaxed text-primary/80">
        these terms cover your use of the a flaky good. website, preorders, and our text message program.
        by placing an order or opting in to texts, you agree to them.
      </p>
      <Section title="preorders">
        <p>preorders are available while each weekly drop is open and items are in stock. pickup time and place are shown on the preorder page and in your order confirmation.</p>
        <p>payments are processed securely by our payment provider. we never see or store your full card number.</p>
      </Section>
      <Section id="sms" title="text messages (sms)">
        <ul>
          <li><span className="font-bold">program:</span> a flaky good. order &amp; pickup updates.</li>
          <li><span className="font-bold">what you'll get:</span> order confirmations, pickup reminders, and changes to your pickup time or place. no marketing.</li>
          <li><span className="font-bold">how you opt in:</span> by checking "receive order and pickup updates on phone" on the preorder or order confirmation page. it's optional and not required to buy anything.</li>
          <li><span className="font-bold">frequency:</span> message frequency varies, usually a few texts per order.</li>
          <li><span className="font-bold">cost:</span> msg &amp; data rates may apply.</li>
          <li><span className="font-bold">opt out:</span> reply <span className="normal-case">STOP</span> to any message. you'll get one final confirmation and no more texts.</li>
          <li><span className="font-bold">help:</span> reply <span className="normal-case">HELP</span> or email {mail}.</li>
          <li>carriers are not liable for delayed or undelivered messages.</li>
        </ul>
        <p>see our <Link to="/privacy" className="underline underline-offset-2">privacy policy</Link> for how we handle your contact details.</p>
      </Section>
      <Section title="changes">
        <p>we may update these terms from time to time. the date at the top shows when they last changed.</p>
      </Section>
      <Section title="contact">
        <p>questions? email {mail}.</p>
      </Section>
    </LegalPage>
  );
}

export function Privacy() {
  return (
    <LegalPage title="privacy" path="/privacy">
      <p className="font-mono text-[15px] leading-relaxed text-primary/80">
        a flaky good. is a small microbakery in Maple Valley, WA. we only collect what we need to make and hand over your order.
      </p>
      <Section title="what we collect">
        <ul>
          <li>your name, email address, and phone number (if you give one).</li>
          <li>what you ordered, the amount paid, and your pickup status.</li>
          <li>whether you opted in to text updates.</li>
          <li>general visit stats (pages viewed, device and browser type, approximate location) through google analytics, which uses cookies. this is not linked to your order.</li>
        </ul>
        <p>card details go directly to our payment provider. we never receive or store your full card number.</p>
      </Section>
      <Section title="how we use it">
        <ul>
          <li>to prepare your order and email your order confirmation and pickup details.</li>
          <li>to text you order and pickup updates, only if you opted in.</li>
          <li>to contact you about a problem with your order.</li>
        </ul>
      </Section>
      <Section id="sms" title="text messages">
        <p className="font-bold">
          no mobile information will be shared with third parties or affiliates for marketing or promotional purposes.
          text messaging opt-in data and consent will not be shared with any third parties.
        </p>
        <p>
          we never sell your information. we only share it with the service providers that run this website, process payments,
          and deliver emails and text messages, and only so they can do that job.
        </p>
        <p>reply <span className="normal-case">STOP</span> at any time to stop texts, or <span className="normal-case">HELP</span> for help.</p>
      </Section>
      <Section title="how long we keep it">
        <p>we keep order records as long as needed to run the bakery and meet tax and accounting requirements.</p>
      </Section>
      <Section title="your choices">
        <p>you can ask us to see, correct, or delete your information by emailing {mail}.</p>
      </Section>
      <Section title="changes">
        <p>if we change this policy, we'll update the date at the top of this page.</p>
      </Section>
      <Section title="contact">
        <p>email {mail}.</p>
      </Section>
    </LegalPage>
  );
}
