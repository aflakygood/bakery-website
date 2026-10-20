-- Secret discount codes typed in brackets in the checkout name field, e.g. "Ayush (friends)".
-- Server-only like private_settings: RLS on, no policies, no anon/authenticated grants.
CREATE TABLE IF NOT EXISTS public.discount_codes (
  code text PRIMARY KEY CHECK (code = lower(btrim(code)) AND code <> ''),
  percent integer NOT NULL CHECK (percent BETWEEN 1 AND 99),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.discount_codes FROM anon, authenticated;
GRANT ALL ON public.discount_codes TO service_role;

INSERT INTO public.discount_codes (code, percent) VALUES ('nintynine', 99), ('friends', 10)
ON CONFLICT (code) DO UPDATE SET percent = EXCLUDED.percent, active = true;

-- total_cents stays the amount actually charged; subtotal_cents is the pre-discount amount.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal_cents integer;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_percent integer;
