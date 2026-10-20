const link = "underline underline-offset-2 hover:text-primary";

// Carrier (CTIA / 10DLC) required disclosure shown next to every SMS opt-in.
// Links open in a new tab so the customer doesn't lose their cart or confirmation page.
export default function SmsDisclosure({ id, className = "" }: { id: string; className?: string }) {
  return (
    <p id={id} className={`font-mono text-[11px] normal-case leading-relaxed text-primary/60 ${className}`}>
      by checking, you agree to receive order and pickup texts from a flaky good. message frequency varies.
      msg &amp; data rates may apply. reply HELP for help, STOP to opt out. consent is not a condition of purchase.{" "}
      <a href="/terms#sms" target="_blank" rel="noopener noreferrer" className={link}>terms</a>
      {" & "}
      <a href="/privacy" target="_blank" rel="noopener noreferrer" className={link}>privacy</a>.
    </p>
  );
}
