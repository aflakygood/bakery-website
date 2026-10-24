ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS match_name boolean NOT NULL DEFAULT false;

INSERT INTO public.discount_codes (code, percent, active, match_name)
VALUES
  ('shail', 10, true, true),
  ('urmi', 10, true, true),
  ('dayana', 10, true, true),
  ('sheenu', 10, true, true),
  ('sowjanya', 10, true, true),
  ('sasi', 10, true, true)
ON CONFLICT (code) DO UPDATE SET
  percent = EXCLUDED.percent,
  active = EXCLUDED.active,
  match_name = EXCLUDED.match_name;
