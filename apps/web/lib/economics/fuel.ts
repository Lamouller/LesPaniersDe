// ============================================================
// Economics helpers — carburant + CO₂ par tournée
// ============================================================

export const DEFAULT_FUEL_PRICES_EUR = {
  diesel: 1.80,
  gasoline: 1.90,
  electric: 0.18, // par kWh
} as const;

export const CO2_KG_PER_UNIT: Record<string, number> = {
  diesel: 2.67,   // kg CO₂ / L
  gasoline: 2.31,
  electric: 0.05, // kg CO₂ / kWh (mix FR nucléaire)
  hybrid: 1.80,   // moyenne
  none: 0,
};

export interface VehicleConfig {
  fuel_type: 'diesel' | 'gasoline' | 'electric' | 'hybrid' | 'none';
  consumption_l_per_100km?: number | null;
  kwh_per_100km?: number | null;
  custom_diesel_price_eur?: number | null;
  custom_gasoline_price_eur?: number | null;
  custom_electric_price_eur?: number | null;
}

export interface RouteEconomics {
  fuel_units: number;          // litres ou kWh
  fuel_unit_label: string;     // 'L' ou 'kWh'
  cost_eur: number;
  co2_kg: number;
  // Économies vs trajet naïf non optimisé (+25 % de distance)
  vs_naive: {
    naive_cost_eur: number;
    naive_co2_kg: number;
    savings_eur: number;
    savings_co2_kg: number;
    savings_pct: number;
  };
  warning?: string;
}

/**
 * Calcule le coût carburant et les émissions CO₂ pour une tournée.
 * @param distance_m Distance totale en mètres (retournée par OSRM)
 * @param v Configuration véhicule du producteur
 */
export function calculateRouteEconomics(
  distance_m: number,
  v: VehicleConfig,
): RouteEconomics | null {
  const distance_km = distance_m / 1000;

  if (v.fuel_type === 'none') {
    // Vélo ou sans carburant — coût nul
    const zero: RouteEconomics = {
      fuel_units: 0,
      fuel_unit_label: '',
      cost_eur: 0,
      co2_kg: 0,
      vs_naive: {
        naive_cost_eur: 0,
        naive_co2_kg: 0,
        savings_eur: 0,
        savings_co2_kg: 0,
        savings_pct: 0,
      },
    };
    return zero;
  }

  // ---- Électrique ----
  if (v.fuel_type === 'electric') {
    if (!v.kwh_per_100km) {
      return {
        fuel_units: 0,
        fuel_unit_label: 'kWh',
        cost_eur: 0,
        co2_kg: 0,
        vs_naive: { naive_cost_eur: 0, naive_co2_kg: 0, savings_eur: 0, savings_co2_kg: 0, savings_pct: 0 },
        warning: "Renseigne ta consommation (kWh/100km) dans Paramètres",
      };
    }
    const kwh = (distance_km * v.kwh_per_100km) / 100;
    const price = v.custom_electric_price_eur ?? DEFAULT_FUEL_PRICES_EUR.electric;
    const cost = kwh * price;
    const co2 = kwh * (CO2_KG_PER_UNIT.electric ?? 0.05);

    // Naïf +25 %
    const naive_kwh = kwh * 1.25;
    const naive_cost = naive_kwh * price;
    const naive_co2 = naive_kwh * (CO2_KG_PER_UNIT.electric ?? 0.05);

    return {
      fuel_units: Math.round(kwh * 10) / 10,
      fuel_unit_label: 'kWh',
      cost_eur: Math.round(cost * 100) / 100,
      co2_kg: Math.round(co2 * 10) / 10,
      vs_naive: {
        naive_cost_eur: Math.round(naive_cost * 100) / 100,
        naive_co2_kg: Math.round(naive_co2 * 10) / 10,
        savings_eur: Math.round((naive_cost - cost) * 100) / 100,
        savings_co2_kg: Math.round((naive_co2 - co2) * 10) / 10,
        savings_pct: 20, // 1 - 1/1.25 = 20 %
      },
    };
  }

  // ---- Thermique / hybride ----
  if (!v.consumption_l_per_100km) {
    return {
      fuel_units: 0,
      fuel_unit_label: 'L',
      cost_eur: 0,
      co2_kg: 0,
      vs_naive: { naive_cost_eur: 0, naive_co2_kg: 0, savings_eur: 0, savings_co2_kg: 0, savings_pct: 0 },
      warning: "Renseigne ta consommation (L/100km) dans Paramètres",
    };
  }

  const liters = (distance_km * v.consumption_l_per_100km) / 100;

  let price: number;
  if (v.fuel_type === 'diesel') {
    price = v.custom_diesel_price_eur ?? DEFAULT_FUEL_PRICES_EUR.diesel;
  } else if (v.fuel_type === 'gasoline') {
    price = v.custom_gasoline_price_eur ?? DEFAULT_FUEL_PRICES_EUR.gasoline;
  } else {
    // hybrid — on prend diesel comme approximation du prix
    price = v.custom_diesel_price_eur ?? DEFAULT_FUEL_PRICES_EUR.diesel;
  }

  const co2Factor = CO2_KG_PER_UNIT[v.fuel_type] ?? 2.0;
  const cost = liters * price;
  const co2 = liters * co2Factor;

  // Naïf +25 %
  const naive_liters = liters * 1.25;
  const naive_cost = naive_liters * price;
  const naive_co2 = naive_liters * co2Factor;

  return {
    fuel_units: Math.round(liters * 10) / 10,
    fuel_unit_label: 'L',
    cost_eur: Math.round(cost * 100) / 100,
    co2_kg: Math.round(co2 * 10) / 10,
    vs_naive: {
      naive_cost_eur: Math.round(naive_cost * 100) / 100,
      naive_co2_kg: Math.round(naive_co2 * 10) / 10,
      savings_eur: Math.round((naive_cost - cost) * 100) / 100,
      savings_co2_kg: Math.round((naive_co2 - co2) * 10) / 10,
      savings_pct: 20,
    },
  };
}

/**
 * Formate le nom affiché du type de carburant
 */
export function fuelTypeLabel(fuel: string): string {
  const labels: Record<string, string> = {
    diesel: 'diesel',
    gasoline: 'essence',
    electric: 'électrique',
    hybrid: 'hybride',
    none: 'aucun',
  };
  return labels[fuel] ?? fuel;
}

/**
 * Formate le nom affiché du type de véhicule
 */
export function vehicleTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    van: 'Fourgonnette',
    car: 'Voiture',
    truck: 'Camion',
    electric: 'Véhicule électrique',
    bike: 'Vélo / cargo',
  };
  return labels[type] ?? type;
}
