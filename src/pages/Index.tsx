import Nav from "@/components/sections/Nav";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import PreOrderSteps from "@/components/sections/PreOrderSteps";
import Drop from "@/components/sections/Drop";
import FAQ from "@/components/sections/FAQ";
import Footer from "@/components/sections/Footer";
import Local from "@/components/sections/Local";
import { usePageMeta } from "@/lib/seo";

export default function Index() {
  usePageMeta();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <Hero />
        <About />
        <Local />
        <PreOrderSteps />
        <Drop />
        <FAQ />
      </main>
      <Footer showContact />
    </div>
  );
}
