-- ============================================================
-- Migration 0008 : Véhicule producteur + calcul carburant/CO₂
-- ============================================================

ALTER TABLE public.producers
  ADD COLUMN IF NOT EXISTS vehicle_type text
    CHECK (vehicle_type IN ('van', 'car', 'truck', 'electric', 'bike')),
  ADD COLUMN IF NOT EXISTS vehicle_fuel_type text
    CHECK (vehicle_fuel_type IN ('diesel', 'gasoline', 'electric', 'hybrid', 'none')),
  ADD COLUMN IF NOT EXISTS vehicle_consumption_l_per_100km numeric(4,1),
  ADD COLUMN IF NOT EXISTS vehicle_kwh_per_100km numeric(4,1),
  ADD COLUMN IF NOT EXISTS custom_diesel_price_eur numeric(5,3),
  ADD COLUMN IF NOT EXISTS custom_gasoline_price_eur numeric(5,3),
  ADD COLUMN IF NOT EXISTS custom_electric_price_eur numeric(5,3),
  ADD COLUMN IF NOT EXISTS vehicle_home_lat double precision,
  ADD COLUMN IF NOT EXISTS vehicle_home_lng double precision,
  ADD COLUMN IF NOT EXISTS vehicle_home_address text;

COMMENT ON COLUMN public.producers.vehicle_type IS 'Type de véhicule utilisé pour les tournées';
COMMENT ON COLUMN public.producers.vehicle_fuel_type IS 'Type de carburant';
COMMENT ON COLUMN public.producers.vehicle_consumption_l_per_100km IS 'Consommation en L/100km pour véhicules thermiques/hybrides';
COMMENT ON COLUMN public.producers.vehicle_kwh_per_100km IS 'Consommation en kWh/100km pour véhicules électriques';
COMMENT ON COLUMN public.producers.custom_diesel_price_eur IS 'Prix diesel personnalisé (override défaut FR)';
COMMENT ON COLUMN public.producers.custom_gasoline_price_eur IS 'Prix essence personnalisé (override défaut FR)';
COMMENT ON COLUMN public.producers.custom_electric_price_eur IS 'Prix électricité personnalisé en €/kWh (override défaut FR)';
COMMENT ON COLUMN public.producers.vehicle_home_lat IS 'Latitude du point de départ tournée (ferme)';
COMMENT ON COLUMN public.producers.vehicle_home_lng IS 'Longitude du point de départ tournée (ferme)';
COMMENT ON COLUMN public.producers.vehicle_home_address IS 'Adresse de la ferme / point de départ tournée';

-- ============================================================
-- Seed : données véhicule pour les producteurs existants
-- ============================================================

-- Nadine : van diesel, 7.5 L/100km, ferme à Puylaurens
UPDATE public.producers
SET
  vehicle_type                  = 'van',
  vehicle_fuel_type             = 'diesel',
  vehicle_consumption_l_per_100km = 7.5,
  vehicle_home_lat              = 43.58,
  vehicle_home_lng              = 2.01,
  vehicle_home_address          = 'Puylaurens, Tarn (81)',
  updated_at                    = now()
WHERE id = '22222222-0000-0000-0000-000000000001';
