import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import OrderMenu from "@/components/OrderMenu";
import Footer from "@/components/sections/Footer";
import logoIcon from "@/assets/logo-icon-v2.png";
import { usePageMeta } from "@/lib/seo";

export default function Preorder() {
  usePageMeta({
    title: "preorder fresh sourdough, croissants & focaccia · Maple Valley, WA · a flaky good.",
    description: "Preorder this week's fresh-baked croissants, pain au chocolat, sourdough bread and focaccia from a flaky good., a Maple Valley, WA microbakery. Local pickup for Covington, Black Diamond, Enumclaw, Ravensdale and nearby.",
    path: "/preorder",
  });
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto grid max-w-[1100px] grid-cols-[1fr_auto_1fr] items-center px-6 py-4 md:px-10">
        <Link to="/#order" aria-label="back" className="inline-flex justify-self-start p-1 text-primary hover:opacity-60">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <Link to="/" aria-label="a flaky good."><img src={logoIcon} alt="a flaky good." className="h-11 w-11" /></Link>
      </header>
      <main><OrderMenu /></main>
      <Footer />
    </div>
  );
}
