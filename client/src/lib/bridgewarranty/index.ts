// BridgeWarranty integration — re-exports + quote engine.
// Plan + tire-rim + coverage matrix data is mirrored from the
// "Bridge Warranty Planner" project (A-Protect V25 brochure).

export {
  warrantyPlans,
  getProviders,
  getPlansByProvider,
  getPlanBySlug,
  getGroupedPlans,
  getPlansByGroup,
  GENERAL_TERMS,
  GENERAL_EXCLUSIONS,
  COVERAGE_TERRITORY,
  WAITING_PERIOD,
  DISPUTE_RESOLUTION,
  type WarrantyPlan,
  type CoverageCategory,
  type PricingTier,
} from "./plans";

export {
  tireRimTiers,
  vehicleClasses,
  coveredServices,
  eligibilityConditions as tireRimEligibility,
  roadsideCoverageConditions,
  type TireRimTier,
  type VehicleClass,
} from "./tire-rim";

export {
  PLAN_COLUMNS,
  coverageMatrix,
  type CoverageStatus,
  type MatrixRow,
  type PlanColumn,
} from "./coverage-matrix";

export {
  checkAllPlanEligibility,
  isPlanEligible,
  isPremiumVehicle,
  getVehicleAge,
  PREMIUM_VEHICLE_MAKES,
  type EligibilityResult,
  type VehicleQuote,
} from "./eligibility";

import type { PricingTier, WarrantyPlan } from "./plans";
import type { TireRimTier, VehicleClass } from "./tire-rim";
import { tireRimTiers, vehicleClasses } from "./tire-rim";
import { isPremiumVehicle } from "./eligibility";

// ── Quote engine ───────────────────────────────────────────────

export type WarrantyQuote = {
  planSlug: string;
  planName: string;
  pricingTier: PricingTier;        // which sub-tier (perClaimAmount) was chosen
  termIndex: number;               // index into pricingTier.terms
  termLabel: string;
  termMonths: number;
  termKm: string;
  deductible: number;
  perClaimAmount: number;
  basePrice: number;
  selectedAddOnLabels: string[];   // e.g. ["Unlimited km", "Zero Deductible"]
  addOnTotal: number;
  premiumVehicleFee: number;
  total: number;
  monthlyEquivalent: number;
};

const isNumeric = (v: number | string | null | undefined): v is number =>
  typeof v === "number" && !isNaN(v);

export function getBasePrice(tier: PricingTier, termIndex: number): number | null {
  // 1. Mileage-banded plans (Diamond Plus): require pickMileageBand first.
  if (tier.mileageBands && tier.mileageBands.length) {
    // Caller must use quoteWithMileageBand instead. Return null to signal.
    return null;
  }
  const baseRow = tier.rows.find((r) => r.label === "Base Price");
  if (!baseRow) return null;
  const v = baseRow.values[termIndex];
  return isNumeric(v) ? v : null;
}

/** Pick the right Diamond-Plus mileage band for a given km reading. */
export function pickMileageBandIndex(tier: PricingTier, km: number): number {
  if (!tier.mileageBands || !tier.mileageBands.length) return 0;
  if (km <= 60000) return 0;
  if (km <= 100000) return 1;
  return Math.min(2, tier.mileageBands.length - 1);
}

export function quoteWarranty(opts: {
  plan: WarrantyPlan;
  tierIndex: number;          // which pricingTier (0-indexed)
  termIndex: number;          // which term within that tier
  selectedAddOnLabels: string[]; // labels to include from tier.rows (excluding "Base Price" / "Premium Vehicle Fee")
  vehicleMake: string;
  vehicleModel: string;
  vehicleKm: number;
}): WarrantyQuote | null {
  const tier = opts.plan.pricingTiers[opts.tierIndex];
  if (!tier) return null;
  const term = tier.terms[opts.termIndex];
  if (!term) return null;

  // Base price: either from "Base Price" row, or from the matching mileage band.
  let basePrice: number | null = null;
  if (tier.mileageBands && tier.mileageBands.length) {
    const bandIdx = pickMileageBandIndex(tier, opts.vehicleKm);
    const v = tier.mileageBands[bandIdx]?.values[opts.termIndex];
    basePrice = isNumeric(v) ? v : null;
  } else {
    basePrice = getBasePrice(tier, opts.termIndex);
  }
  if (basePrice == null) return null;

  // Add-ons.
  let addOnTotal = 0;
  const addedLabels: string[] = [];
  for (const row of tier.rows) {
    if (row.label === "Base Price" || row.label === "Premium Vehicle Fee") continue;
    if (!opts.selectedAddOnLabels.includes(row.label)) continue;
    const v = row.values[opts.termIndex];
    if (isNumeric(v)) {
      addOnTotal += v;
      addedLabels.push(row.label);
    } else if (v === "Included") {
      addedLabels.push(`${row.label} (included)`);
    }
  }

  // Premium-vehicle fee.
  let premiumFee = 0;
  if (isPremiumVehicle(opts.vehicleMake, opts.vehicleModel)) {
    const pvRow = tier.rows.find((r) => r.label === "Premium Vehicle Fee");
    if (pvRow) {
      const v = pvRow.values[opts.termIndex];
      if (isNumeric(v)) premiumFee = v;
    }
  }

  const total = basePrice + addOnTotal + premiumFee;
  return {
    planSlug: opts.plan.slug,
    planName: opts.plan.name,
    pricingTier: tier,
    termIndex: opts.termIndex,
    termLabel: term.label,
    termMonths: term.months,
    termKm: term.km,
    deductible: tier.deductible,
    perClaimAmount: tier.perClaimAmount,
    basePrice,
    selectedAddOnLabels: addedLabels,
    addOnTotal,
    premiumVehicleFee: premiumFee,
    total,
    monthlyEquivalent: term.months > 0 ? Math.round(total / term.months) : total,
  };
}

// ── Tire & Rim quote engine ────────────────────────────────────

export type TireRimQuote = {
  tierSlug: string;
  tierName: string;
  vehicleClass: 1 | 2 | 3;
  termLabel: string;
  termMonths: number;
  total: number;
};

export function detectVehicleClass(make: string): 1 | 2 | 3 {
  const upper = (make || "").toUpperCase();
  for (const vc of vehicleClasses) {
    if (vc.makes.some((m) => upper.includes(m.toUpperCase().replace(/\s*\(.*$/, "").trim()))) {
      return vc.classNumber as 1 | 2 | 3;
    }
  }
  return 1;
}

export function quoteTireRim(opts: {
  tier: TireRimTier;
  termIndex: number;
  vehicleMake: string;
}): TireRimQuote | null {
  const cls = detectVehicleClass(opts.vehicleMake);
  const row = opts.tier.pricing[opts.termIndex];
  if (!row) return null;
  const total = cls === 1 ? row.class1 : cls === 2 ? row.class2 : row.class3;
  const months = parseInt(row.term, 10) || 0;
  return {
    tierSlug: opts.tier.slug,
    tierName: opts.tier.name,
    vehicleClass: cls,
    termLabel: row.term,
    termMonths: months,
    total,
  };
}

export function generateContractNumber(prefix = "BW"): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ymd}-${rand}`;
}
