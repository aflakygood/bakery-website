import Nav from "@/components/sections/Nav";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import PreOrderSteps from "@/components/sections/PreOrderSteps";
import Menu from "@/components/sections/Menu";
import Drop from "@/components/sections/Drop";
import FAQ from "@/components/sections/FAQ";
import Footer from "@/components/sections/Footer";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Bakery",
  name: "a flaky good.",
  description:
    "Home microbakery in Maple Valley specializing in small batch laminated pastries and long-ferment sourdough breads.",
  address: { "@type": "PostalAddress", addressLocality: "Maple Valley", addressRegion: "WA", addressCountry: "US" },
  servesCuisine: ["French Pastry", "Sourdough"],
};

export default function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Nav />
      <main>
        <Hero />
        <About />
        <PreOrderSteps />
        <Menu />
        <Drop />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
