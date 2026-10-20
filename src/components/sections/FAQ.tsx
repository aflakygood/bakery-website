import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    q: "how do preorders work?",
    a: "drops open a few days before pickup day. menu and order window are announced on instagram. place your order through the website and your spot is secured.",
  },
  {
    q: "where is pickup?",
    a: "pickup is in maple valley, wa. the exact address is shared via message once your order is confirmed.",
  },
  {
    q: "do you ship or deliver?",
    a: "not at this time. everything is baked fresh for same-day pickup to keep quality and texture at their best.",
  },
  {
    q: "do you cater?",
    a: "yes, and we love it. we have an extended catering menu — dm @aflakygood on instagram for details.",
  },
  {
    q: "can i modify or cancel my order?",
    a: "you can change your order until preorders close. after that, we source and prep ingredients for each order, so we can't take cancellations — but reach out and we'll do our best to help.",
  },
  {
    q: "do your products contain allergens?",
    a: "bakes include wheat and dairy. some items contain nuts or seeds — full allergen info is shared on each drop.",
  },
  {
    q: "how do i hear about upcoming drops?",
    a: "follow @aflakygood on Instagram. drops, menus, and pickup times are posted there every week.",
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="relative pb-20 pt-10 md:pb-32 md:pt-14">
      <div className="mx-auto max-w-[900px] px-6 md:px-10">
        <div className="text-center">
          <h2 className="font-display text-4xl font-black tracking-brand text-primary md:text-6xl">
            frequently asked.
          </h2>
        </div>

        <Accordion type="single" collapsible className="mt-12 md:mt-16">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-b border-primary/15">
              <AccordionTrigger className="py-5 text-left font-display text-base font-black tracking-brand text-primary hover:no-underline md:text-lg">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="font-mono text-[13px] leading-relaxed text-primary/75">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}