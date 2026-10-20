-- Server-only settings (e.g. the full pickup address). RLS is on with no policies and
-- anon/authenticated have no grants, so only edge functions (service_role) can read it.
-- The address is revealed to a customer only by confirm-order after a verified payment.
CREATE TABLE IF NOT EXISTS public.private_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.private_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.private_settings FROM anon, authenticated;
GRANT ALL ON public.private_settings TO service_role;

INSERT INTO public.private_settings (key, value)
VALUES ('pickup_address', '23541 SE 271st ST, Maple Valley')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
