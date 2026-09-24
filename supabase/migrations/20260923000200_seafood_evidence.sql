-- Optional v1 additions: preserve all GET response fields used by B.
-- Profile and readings are synthetic evidence metadata, never regulatory approval.
alter table public.shipments add column seafood_profile jsonb
  check (seafood_profile is null or jsonb_typeof(seafood_profile) = 'object');
alter table public.containers add column temperature_readings jsonb not null default '[]'::jsonb
  check (jsonb_typeof(temperature_readings) = 'array');
