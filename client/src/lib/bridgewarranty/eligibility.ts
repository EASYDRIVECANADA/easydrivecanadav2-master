// BridgeWarranty plan eligibility — adapted from A-Protect V25 brochure rules.
// Shared with the Bridge Warranty Planner project.

export type VehicleQuote = {
  year: number;
  make: string;
  model: string;
  mileage: number;
};

export type EligibilityResult = {
  planSlug: string;
  eligible: boolean;
  reason?: string;
};

const CURRENT_YEAR = new Date().getFullYear();

export const PREMIUM_VEHICLE_MAKES = [
  "BMW", "Mercedes", "Mercedes-Benz", "Audi", "Tesla", "Porsche", "Jaguar",
  "Lamborghini", "Ferrari", "Aston Martin", "Bentley", "McLaren", "Bugatti",
  "Maserati", "Alfa Romeo", "Land Rover", "Volvo", "MINI",
  "Lotus", "Rolls-Royce", "Rolls Royce", "DMC",
];

export const PREMIUM_VEHICLE_MODELS: { make: string; models: string[] }[] = [
  { make: "Subaru", models: ["WRX"] },
  { make: "Chevrolet", models: ["Corvette"] },
  { make: "Hummer", models: [] },
];

export function isPremiumVehicle(make: string, model: string): boolean {
  const upperMake = (make || "").toUpperCase();
  const upperModel = (model || "").toUpperCase();
  if (PREMIUM_VEHICLE_MAKES.some((m) => m.toUpperCase() === upperMake)) return true;
  for (const pm of PREMIUM_VEHICLE_MODELS) {
    if (pm.make.toUpperCase() === upperMake) {
      if (pm.models.length === 0) return true;
      if (pm.models.some((m) => upperModel.includes(m.toUpperCase()))) return true;
    }
  }
  return false;
}

export function getVehicleAge(year: number): number {
  return CURRENT_YEAR - year;
}

export function checkAllPlanEligibility(vehicle: VehicleQuote): EligibilityResult[] {
  const age = getVehicleAge(vehicle.year);
  const km = vehicle.mileage;
  const out: EligibilityResult[] = [];

  // Powertrain Bronze/Silver/Gold/Platinum + Essential + Premium Special + Luxury — any year, any make, up to 220,000 km
  for (const slug of [
    "powertrain-bronze",
    "powertrain-silver",
    "powertrain-gold",
    "powertrain-platinum",
    "essential",
    "premium-special",
    "luxury",
  ]) {
    if (km > 220000) {
      out.push({ planSlug: slug, eligible: false, reason: "Mileage exceeds 220,000 km limit" });
    } else {
      out.push({ planSlug: slug, eligible: true });
    }
  }

  // Diamond Plus — 7 years or newer, 160,000 km
  if (age > 7) {
    out.push({ planSlug: "diamond-plus", eligible: false, reason: `Vehicle must be 7 years or newer (yours is ${age} years old)` });
  } else if (km > 160000) {
    out.push({ planSlug: "diamond-plus", eligible: false, reason: "Mileage exceeds 160,000 km limit" });
  } else {
    out.push({ planSlug: "diamond-plus", eligible: true });
  }

  // Driver Program — 10 years or newer, 180,000 km
  if (age > 10) {
    out.push({ planSlug: "driver", eligible: false, reason: `Vehicle must be 10 years or newer (yours is ${age} years old)` });
  } else if (km > 180000) {
    out.push({ planSlug: "driver", eligible: false, reason: "Mileage exceeds 180,000 km limit" });
  } else {
    out.push({ planSlug: "driver", eligible: true });
  }

  // Pro Warranty — 10 years / 200,000 km (best case)
  if (age > 10) {
    out.push({ planSlug: "pro", eligible: false, reason: `Vehicle must be 10 years or newer (yours is ${age} years old)` });
  } else if (km > 200000) {
    out.push({ planSlug: "pro", eligible: false, reason: "Mileage exceeds 200,000 km limit" });
  } else {
    out.push({ planSlug: "pro", eligible: true });
  }

  // Top Up — needs an existing OEM warranty; we can't verify, so list as "Inquire"
  out.push({ planSlug: "top-up", eligible: true, reason: "Requires active manufacturer powertrain warranty — confirmed at signing." });

  // Tire & Rim — 10 years or newer
  if (age > 10) {
    out.push({ planSlug: "tire-rim", eligible: false, reason: `Vehicle must be 10 years or newer (yours is ${age} years old)` });
  } else {
    out.push({ planSlug: "tire-rim", eligible: true });
  }

  return out;
}

export function isPlanEligible(vehicle: VehicleQuote, planSlug: string): EligibilityResult {
  const all = checkAllPlanEligibility(vehicle);
  return all.find((r) => r.planSlug === planSlug) ?? { planSlug, eligible: true };
}
