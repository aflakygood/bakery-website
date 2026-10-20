ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT false;
