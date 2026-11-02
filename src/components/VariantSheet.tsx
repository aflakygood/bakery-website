import { Minus, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { money } from "@/lib/variants";

export type VariantOption = { id: string; label: string; priceCents: number };

export type VariantSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Any number of options; each carries its own price. */
  options: VariantOption[];
  /** Quantity per option id; missing ids count as 0. */
  quantities: Record<string, number>;
  onQuantityChange: (optionId: string, delta: 1 | -1) => void;
  /** Inline note under the options (limit and minimum messages). */
  message?: string;
  confirmLabel: string;
  confirmTotalCents: number;
  confirmDisabled?: boolean;
  onConfirm: () => void;
};

/**
 * Picks quantities across an item's variations. Renders as a centered modal dialog on desktop
 * and a bottom sheet on phones. Limits and cart logic stay with the caller.
 */
export default function VariantSheet(props: VariantSheetProps) {
  const isMobile = useIsMobile();
  const { open, onOpenChange, title, description } = props;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[90vh] border-primary/15">
          <DrawerHeader className="px-6 pb-2 pt-3 text-left">
            <DrawerTitle className="font-display text-2xl font-black leading-tight tracking-brand text-primary">{title}</DrawerTitle>
            <DrawerDescription className={description ? "font-mono text-[13px] text-primary/70" : "sr-only"}>
              {description || "choose a variation"}
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <SheetBody {...props} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md gap-0 overflow-y-auto rounded-[6px] border-primary/15 p-7 sm:rounded-[6px]">
        <DialogHeader className="mb-5 pr-6 text-left">
          <DialogTitle className="font-display text-2xl font-black leading-tight tracking-brand text-primary">{title}</DialogTitle>
          <DialogDescription className={description ? "font-mono text-[13px] text-primary/70" : "sr-only"}>
            {description || "choose a variation"}
          </DialogDescription>
        </DialogHeader>
        <SheetBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

function SheetBody({ options, quantities, onQuantityChange, message, confirmLabel, confirmTotalCents, confirmDisabled, onConfirm }: VariantSheetProps) {
  const step = "flex h-10 w-10 items-center justify-center rounded-full bg-background text-primary transition-opacity disabled:opacity-40";
  return (
    <>
      <ul className="space-y-3">
        {options.map((o) => {
          const n = quantities[o.id] ?? 0;
          return (
            <li key={o.id} className="flex items-center justify-between gap-4 rounded-[6px] bg-secondary px-4 py-3.5">
              <div className="min-w-0">
                <p className="break-words font-display text-lg font-black leading-tight tracking-brand text-primary">{o.label.toLowerCase()}</p>
                <p className="mt-0.5 font-mono text-[13px] text-primary/70">{money(o.priceCents)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button type="button" aria-label={`less ${o.label}`} disabled={n === 0} onClick={() => onQuantityChange(o.id, -1)} className={step}>
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-5 text-center font-mono text-[15px] text-primary" aria-live="polite" aria-atomic="true" aria-label={`${o.label} quantity`}>{n}</span>
                <button type="button" aria-label={`more ${o.label}`} onClick={() => onQuantityChange(o.id, 1)} className={step}>
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {message && <p role="alert" className="mt-3 text-center font-mono text-[12px] text-destructive">{message}</p>}
      <button type="button" disabled={confirmDisabled} onClick={onConfirm}
        className="mt-6 flex w-full items-center justify-between rounded-[6px] bg-primary px-5 py-4 font-mono text-[15px] lowercase tracking-brand text-primary-foreground transition-colors hover:bg-[hsl(var(--green-deep))] disabled:opacity-50">
        <span>{confirmLabel}</span>
        <span>{money(confirmTotalCents)}</span>
      </button>
    </>
  );
}
