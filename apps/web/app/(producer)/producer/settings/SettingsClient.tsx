'use client';

import React, { useState } from 'react';
import { Car, Zap, Truck, Fuel, Leaf, ChevronDown, ChevronUp, Loader2, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DEFAULT_FUEL_PRICES_EUR } from '@/lib/economics/fuel';

// ---- Types ----
type VehicleType = 'van' | 'car' | 'truck' | 'electric' | 'bike';
type FuelType = 'diesel' | 'gasoline' | 'electric' | 'hybrid' | 'none';

interface ProducerVehicleData {
  vehicle_type: VehicleType | null;
  vehicle_fuel_type: FuelType | null;
  vehicle_consumption_l_per_100km: number | null;
  vehicle_kwh_per_100km: number | null;
  custom_diesel_price_eur: number | null;
  custom_gasoline_price_eur: number | null;
  custom_electric_price_eur: number | null;
  vehicle_home_lat: number | null;
  vehicle_home_lng: number | null;
  vehicle_home_address: string | null;
}

interface SettingsClientProps {
  readOnly: boolean;
  initial: ProducerVehicleData;
}

const VEHICLE_OPTIONS: { value: VehicleType; label: string; icon: React.ReactNode }[] = [
  { value: 'van', label: 'Fourgonnette', icon: <Truck className="w-4 h-4" /> },
  { value: 'car', label: 'Voiture', icon: <Car className="w-4 h-4" /> },
  { value: 'truck', label: 'Camion', icon: <Truck className="w-4 h-4" /> },
  { value: 'electric', label: 'Véhicule électrique', icon: <Zap className="w-4 h-4" /> },
  { value: 'bike', label: 'Vélo / cargo', icon: <Leaf className="w-4 h-4" /> },
];

const FUEL_OPTIONS: { value: FuelType; label: string }[] = [
  { value: 'diesel', label: 'Diesel' },
  { value: 'gasoline', label: 'Essence' },
  { value: 'electric', label: 'Électrique' },
  { value: 'hybrid', label: 'Hybride' },
  { value: 'none', label: 'Aucun (vélo, cargo...)' },
];

export function SettingsClient({ readOnly, initial }: SettingsClientProps) {
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(initial.vehicle_type);
  const [fuelType, setFuelType] = useState<FuelType | null>(initial.vehicle_fuel_type);
  const [consumptionL, setConsumptionL] = useState<string>(
    initial.vehicle_consumption_l_per_100km != null ? String(initial.vehicle_consumption_l_per_100km) : ''
  );
  const [consumptionKwh, setConsumptionKwh] = useState<string>(
    initial.vehicle_kwh_per_100km != null ? String(initial.vehicle_kwh_per_100km) : ''
  );
  const [homeAddress, setHomeAddress] = useState<string>(initial.vehicle_home_address ?? '');
  const [homeLat, setHomeLat] = useState<string>(
    initial.vehicle_home_lat != null ? String(initial.vehicle_home_lat) : ''
  );
  const [homeLng, setHomeLng] = useState<string>(
    initial.vehicle_home_lng != null ? String(initial.vehicle_home_lng) : ''
  );

  // Custom prices
  const [showCustomPrices, setShowCustomPrices] = useState(false);
  const [customDiesel, setCustomDiesel] = useState<string>(
    initial.custom_diesel_price_eur != null ? String(initial.custom_diesel_price_eur) : ''
  );
  const [customGasoline, setCustomGasoline] = useState<string>(
    initial.custom_gasoline_price_eur != null ? String(initial.custom_gasoline_price_eur) : ''
  );
  const [customElectric, setCustomElectric] = useState<string>(
    initial.custom_electric_price_eur != null ? String(initial.custom_electric_price_eur) : ''
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isElectric = fuelType === 'electric';
  const isBikeOrNone = fuelType === 'none' || vehicleType === 'bike';

  async function handleSave() {
    if (readOnly) return;
    setSaving(true);
    setSaved(false);
    setError(null);

    const body = {
      vehicle_type: vehicleType,
      vehicle_fuel_type: fuelType,
      vehicle_consumption_l_per_100km: !isElectric && consumptionL ? parseFloat(consumptionL) : null,
      vehicle_kwh_per_100km: isElectric && consumptionKwh ? parseFloat(consumptionKwh) : null,
      custom_diesel_price_eur: customDiesel ? parseFloat(customDiesel) : null,
      custom_gasoline_price_eur: customGasoline ? parseFloat(customGasoline) : null,
      custom_electric_price_eur: customElectric ? parseFloat(customElectric) : null,
      vehicle_home_address: homeAddress || null,
      vehicle_home_lat: homeLat ? parseFloat(homeLat) : null,
      vehicle_home_lng: homeLng ? parseFloat(homeLng) : null,
    };

    try {
      const res = await fetch('/api/producer/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? 'Erreur serveur');
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setError('Erreur réseau');
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'w-full px-3 py-2 text-sm bg-background border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed';

  const selectClass =
    'w-full px-3 py-2 text-sm bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          Producteur
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Paramètres véhicule</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ces informations permettent de calculer le coût carburant et les émissions CO₂ de vos tournées.
        </p>
      </div>

      {readOnly && (
        <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-600 dark:text-amber-400">
          Mode observation — lecture seule.
        </div>
      )}

      {/* Véhicule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Car className="w-4 h-4 text-muted-foreground" />
            Type de véhicule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Véhicule
            </label>
            <select
              className={selectClass}
              value={vehicleType ?? ''}
              onChange={(e) => setVehicleType((e.target.value as VehicleType) || null)}
              disabled={readOnly}
            >
              <option value="">— Sélectionner —</option>
              {VEHICLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Carburant
            </label>
            <select
              className={selectClass}
              value={fuelType ?? ''}
              onChange={(e) => setFuelType((e.target.value as FuelType) || null)}
              disabled={readOnly}
            >
              <option value="">— Sélectionner —</option>
              {FUEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Consommation — conditionnel */}
          {!isBikeOrNone && fuelType && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {isElectric ? 'Consommation (kWh/100km)' : 'Consommation (L/100km)'}
              </label>
              <input
                type="number"
                className={inputClass}
                min="0"
                step="0.1"
                placeholder={isElectric ? 'ex : 18.0' : 'ex : 7.5'}
                value={isElectric ? consumptionKwh : consumptionL}
                onChange={(e) =>
                  isElectric ? setConsumptionKwh(e.target.value) : setConsumptionL(e.target.value)
                }
                disabled={readOnly}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ferme / point de départ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Fuel className="w-4 h-4 text-muted-foreground" />
            Point de départ tournée
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Adresse de la ferme
            </label>
            <input
              type="text"
              className={inputClass}
              placeholder="ex : Puylaurens, Tarn (81)"
              value={homeAddress}
              onChange={(e) => setHomeAddress(e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Latitude
              </label>
              <input
                type="number"
                className={inputClass}
                step="0.0001"
                placeholder="ex : 43.5800"
                value={homeLat}
                onChange={(e) => setHomeLat(e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Longitude
              </label>
              <input
                type="number"
                className={inputClass}
                step="0.0001"
                placeholder="ex : 2.0100"
                value={homeLng}
                onChange={(e) => setHomeLng(e.target.value)}
                disabled={readOnly}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prix carburant personnalisés */}
      <Card>
        <CardHeader>
          <button
            type="button"
            className="w-full flex items-center justify-between text-base font-semibold text-foreground"
            onClick={() => setShowCustomPrices((v) => !v)}
          >
            <span className="flex items-center gap-2">
              <Leaf className="w-4 h-4 text-muted-foreground" />
              Prix carburant personnalisés
            </span>
            {showCustomPrices ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          <p className="text-xs text-muted-foreground mt-1">
            Défauts FR : diesel {DEFAULT_FUEL_PRICES_EUR.diesel} €/L · essence {DEFAULT_FUEL_PRICES_EUR.gasoline} €/L · électrique {DEFAULT_FUEL_PRICES_EUR.electric} €/kWh
          </p>
        </CardHeader>

        {showCustomPrices && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Diesel (€/L)
                </label>
                <input
                  type="number"
                  className={inputClass}
                  step="0.001"
                  placeholder={String(DEFAULT_FUEL_PRICES_EUR.diesel)}
                  value={customDiesel}
                  onChange={(e) => setCustomDiesel(e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Essence (€/L)
                </label>
                <input
                  type="number"
                  className={inputClass}
                  step="0.001"
                  placeholder={String(DEFAULT_FUEL_PRICES_EUR.gasoline)}
                  value={customGasoline}
                  onChange={(e) => setCustomGasoline(e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Électrique (€/kWh)
                </label>
                <input
                  type="number"
                  className={inputClass}
                  step="0.001"
                  placeholder={String(DEFAULT_FUEL_PRICES_EUR.electric)}
                  value={customElectric}
                  onChange={(e) => setCustomElectric(e.target.value)}
                  disabled={readOnly}
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Erreur / Save */}
      {error && (
        <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
          {error}
        </div>
      )}

      {!readOnly && (
        <Button
          type="button"
          onClick={() => { void handleSave(); }}
          disabled={saving || saved}
          className="w-full sm:w-auto gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enregistrement…
            </>
          ) : saved ? (
            <>
              <Check className="w-4 h-4" />
              Enregistré
            </>
          ) : (
            'Enregistrer'
          )}
        </Button>
      )}
    </div>
  );
}
