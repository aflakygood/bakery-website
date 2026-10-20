ALTER TABLE public.drops
  ADD COLUMN IF NOT EXISTS pickup_date date,
  ADD COLUMN IF NOT EXISTS pickup_start time,
  ADD COLUMN IF NOT EXISTS pickup_end time,
  ADD COLUMN IF NOT EXISTS pickup_location text NOT NULL DEFAULT '';
