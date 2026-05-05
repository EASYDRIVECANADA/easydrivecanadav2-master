// Coverage comparison matrix from page 4 of the A-Protect brochure
// ✓ = included, ● = available as add-on (yellow), ◉ = term/coverage specific (blue), "" = not available

export type CoverageStatus = "included" | "available" | "specific" | "none";

export interface MatrixRow {
  category: string;
  section: "powertrain" | "additional";
  bold?: boolean;
  highlight?: boolean;
  values: Record<string, CoverageStatus>;
}

export interface PlanColumn {
  key: string;
  label: string;
  sublabel: string;
  claimRange: string;
  color: string;  // header background color
  textColor?: string;
}

export const PLAN_COLUMNS: PlanColumn[] = [
  { key: "powertrain", label: "Powertrain", sublabel: "Bronze / Silver / Gold / Platinum", claimRange: "$750 – $3,000", color: "#1a2744" },
  { key: "essential", label: "Essential", sublabel: "Warranty", claimRange: "$1,000 – $10,000", color: "#5b6b3c" },
  { key: "premium-special", label: "Premium Special", sublabel: "Warranty", claimRange: "$3,000 – $5,000", color: "#3d5a3a" },
  { key: "luxury", label: "Luxury", sublabel: "Warranty", claimRange: "$1,000 – $3,000", color: "#c8a82e", textColor: "#1a1a1a" },
  { key: "diamond-plus", label: "Diamond Plus", sublabel: "Warranty", claimRange: "$5,000 – $20,000", color: "#3a2a50" },
  { key: "top-up", label: "Top Up", sublabel: "Warranty", claimRange: "$5,000 – $10,000", color: "#7b1e1e" },
];

export const coverageMatrix: MatrixRow[] = [
  // ═══════════════════════════════════════════════
  // POWERTRAIN COVERAGE
  // ═══════════════════════════════════════════════
  { category: "Engine", section: "powertrain", values: { "powertrain": "included", "essential": "included", "premium-special": "included", "luxury": "included", "diamond-plus": "included", "top-up": "none" } },
  { category: "Transmission", section: "powertrain", values: { "powertrain": "included", "essential": "included", "premium-special": "included", "luxury": "included", "diamond-plus": "included", "top-up": "none" } },
  { category: "Transfer Case/4x4", section: "powertrain", values: { "powertrain": "included", "essential": "included", "premium-special": "included", "luxury": "included", "diamond-plus": "included", "top-up": "none" } },
  { category: "Turbo/Supercharger", section: "powertrain", values: { "powertrain": "included", "essential": "included", "premium-special": "included", "luxury": "included", "diamond-plus": "included", "top-up": "none" } },
  { category: "Differential", section: "powertrain", values: { "powertrain": "included", "essential": "included", "premium-special": "included", "luxury": "included", "diamond-plus": "included", "top-up": "none" } },
  { category: "Towing", section: "powertrain", values: { "powertrain": "included", "essential": "included", "premium-special": "included", "luxury": "included", "diamond-plus": "included", "top-up": "included" } },
  { category: "Trip Interruption", section: "powertrain", values: { "powertrain": "included", "essential": "included", "premium-special": "included", "luxury": "included", "diamond-plus": "included", "top-up": "included" } },
  { category: "Roadside Coverage", section: "powertrain", values: { "powertrain": "none", "essential": "included", "premium-special": "included", "luxury": "included", "diamond-plus": "included", "top-up": "included" } },
  { category: "Seals & Gaskets", section: "powertrain", values: { "powertrain": "available", "essential": "included", "premium-special": "included", "luxury": "included", "diamond-plus": "included", "top-up": "included" } },
  { category: "Car Rental", section: "powertrain", values: { "powertrain": "available", "essential": "included", "premium-special": "included", "luxury": "included", "diamond-plus": "included", "top-up": "included" } },
  { category: "Wear & Tear", section: "powertrain", values: { "powertrain": "none", "essential": "included", "premium-special": "included", "luxury": "included", "diamond-plus": "included", "top-up": "included" } },

  // ═══════════════════════════════════════════════
  // ADDITIONAL OPTIONS
  // ═══════════════════════════════════════════════
  { category: "Electrical", section: "additional", values: { "powertrain": "none", "essential": "none", "premium-special": "included", "luxury": "included", "diamond-plus": "included", "top-up": "included" } },
  { category: "Fuel System", section: "additional", values: { "powertrain": "none", "essential": "none", "premium-special": "none", "luxury": "included", "diamond-plus": "included", "top-up": "included" } },
  { category: "Air Conditioning", section: "additional", values: { "powertrain": "specific", "essential": "available", "premium-special": "included", "luxury": "included", "diamond-plus": "included", "top-up": "included" } },
  { category: "Brakes", section: "additional", values: { "powertrain": "none", "essential": "none", "premium-special": "none", "luxury": "included", "diamond-plus": "included", "top-up": "included" } },
  { category: "Cooling System", section: "additional", values: { "powertrain": "none", "essential": "none", "premium-special": "included", "luxury": "included", "diamond-plus": "included", "top-up": "none" } },
  { category: "Front Suspension", section: "additional", values: { "powertrain": "none", "essential": "none", "premium-special": "none", "luxury": "included", "diamond-plus": "included", "top-up": "included" } },
  { category: "Rear Suspension", section: "additional", values: { "powertrain": "none", "essential": "none", "premium-special": "none", "luxury": "included", "diamond-plus": "included", "top-up": "included" } },
  { category: "Power Steering", section: "additional", values: { "powertrain": "none", "essential": "none", "premium-special": "none", "luxury": "included", "diamond-plus": "included", "top-up": "included" } },
  { category: "Supplementary Parts", section: "additional", values: { "powertrain": "none", "essential": "none", "premium-special": "none", "luxury": "included", "diamond-plus": "included", "top-up": "included" } },
  { category: "Zero Deductible", section: "additional", values: { "powertrain": "available", "essential": "available", "premium-special": "available", "luxury": "available", "diamond-plus": "included", "top-up": "included" } },
  { category: "Hi-Tech Components", section: "additional", values: { "powertrain": "specific", "essential": "specific", "premium-special": "specific", "luxury": "specific", "diamond-plus": "included", "top-up": "none" } },
  { category: "Hi-Tech ELITE", section: "additional", values: { "powertrain": "none", "essential": "specific", "premium-special": "specific", "luxury": "none", "diamond-plus": "available", "top-up": "available" } },
  { category: "Powertrain PLUS", section: "additional", bold: true, values: { "powertrain": "none", "essential": "none", "premium-special": "none", "luxury": "none", "diamond-plus": "available", "top-up": "available" } },
  { category: "Hybrid Components", section: "additional", highlight: true, values: { "powertrain": "none", "essential": "specific", "premium-special": "specific", "luxury": "specific", "diamond-plus": "available", "top-up": "available" } },
  { category: "Unlimited km", section: "additional", highlight: true, values: { "powertrain": "specific", "essential": "specific", "premium-special": "specific", "luxury": "specific", "diamond-plus": "specific", "top-up": "specific" } },
  { category: "Upgrade to $7,500 Per Claim", section: "additional", values: { "powertrain": "none", "essential": "specific", "premium-special": "none", "luxury": "none", "diamond-plus": "none", "top-up": "none" } },
  { category: "Upgrade to $10,000 Per Claim", section: "additional", values: { "powertrain": "none", "essential": "specific", "premium-special": "specific", "luxury": "none", "diamond-plus": "specific", "top-up": "specific" } },
  { category: "Upgrade to $20,000 Per Claim", section: "additional", values: { "powertrain": "none", "essential": "none", "premium-special": "none", "luxury": "none", "diamond-plus": "specific", "top-up": "none" } },
];
