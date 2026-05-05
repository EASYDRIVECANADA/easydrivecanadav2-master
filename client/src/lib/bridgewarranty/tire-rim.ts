// Tire and Rim Protection data from page 18-19 of the A-Protect brochure V25

export interface TireRimTier {
  name: string;
  slug: string;
  bestValue?: boolean;
  includes: string[];
  pricing: { term: string; class1: number; class2: number; class3: number }[];
}

export interface VehicleClass {
  classNumber: number;
  makes: string[];
}

export interface CoveredService {
  name: string;
  description: string;
  subItems?: string[];
  tiers: string[]; // which tier slugs include this service
}

export interface EligibilityCondition {
  label: string;
  detail: string;
}

export const eligibilityConditions: EligibilityCondition[] = [
  {
    label: "Vehicle Age",
    detail: "Available on vehicles 10 years or newer.",
  },
  {
    label: "Commercial Use",
    detail: "Not eligible for commercial business use.",
  },
  {
    label: "Claim Limits",
    detail: "Maximum limits apply. Please see the Terms and Conditions for a complete list of coverage and limitations.",
  },
];

export const disclaimers: string[] = [
  "This is not a Contract. Please see the Terms and Conditions of the Tire and Rim Protection Agreement.",
  "Please see the Terms and Conditions for more information.",
];

export const vehicleClasses: VehicleClass[] = [
  {
    classNumber: 1,
    makes: [
      "Buick",
      "Chevrolet (except Corvette)",
      "Chrysler",
      "Dodge (except Viper)",
      "Ford (except GT350)",
      "GMC",
      "Honda",
      "Hyundai",
      "Jeep",
      "Kia",
      "Mitsubishi",
      "Nissan",
      "Subaru",
      "Toyota",
      "Volkswagen",
    ],
  },
  {
    classNumber: 2,
    makes: [
      "Acura",
      "Cadillac",
      "Hummer",
      "Infiniti",
      "Jaguar",
      "Land Rover",
      "Lexus",
      "Lincoln",
      "Saab",
      "Volvo",
    ],
  },
  {
    classNumber: 3,
    makes: [
      "Audi",
      "BMW",
      "Mercedes",
      "MINI",
      "Range Rover",
      "Maserati",
      "Porsche",
      "Dodge Viper",
      "Alfa Romeo",
    ],
  },
];

export const tireRimTiers: TireRimTier[] = [
  {
    name: "Essential Protection",
    slug: "essential",
    includes: [
      "Tire/Wheel/Rim Repair and Replacement",
      "Tire and Wheel Mounting and Balancing",
      "Roadside Coverage",
    ],
    pricing: [
      { term: "24 Months", class1: 630, class2: 750, class3: 1050 },
      { term: "36 Months", class1: 640, class2: 760, class3: 1080 },
      { term: "48 Months", class1: 650, class2: 770, class3: 1110 },
      { term: "60 Months", class1: 660, class2: 780, class3: 1140 },
      { term: "72 Months", class1: 670, class2: 790, class3: 1170 },
      { term: "84 Months", class1: 680, class2: 800, class3: 1200 },
    ],
  },
  {
    name: "Extended Protection",
    slug: "extended",
    includes: [
      "Tire/Wheel/Rim Repair and Replacement",
      "Tire and Wheel Mounting and Balancing",
      "Roadside Coverage",
      "Key and Remote Replacement",
      "Car Rental",
    ],
    pricing: [
      { term: "24 Months", class1: 970, class2: 1150, class3: 1560 },
      { term: "36 Months", class1: 980, class2: 1170, class3: 1572 },
      { term: "48 Months", class1: 990, class2: 1190, class3: 1600 },
      { term: "60 Months", class1: 1000, class2: 1205, class3: 1619 },
      { term: "72 Months", class1: 1010, class2: 1215, class3: 1629 },
      { term: "84 Months", class1: 1020, class2: 1230, class3: 1649 },
    ],
  },
  {
    name: "Superior Protection",
    slug: "superior",
    bestValue: true,
    includes: [
      "Tire/Wheel/Rim Repair and Replacement",
      "Tire and Wheel Mounting and Balancing",
      "Roadside Coverage",
      "Key and Remote Replacement",
      "Car Rental",
      "Windshield, Headlight and Taillight Lens Protection",
      "Paintless Dent Repair",
      "Rip/Tear/Burn Puncture Repair",
    ],
    pricing: [
      { term: "24 Months", class1: 1295, class2: 1507, class3: 1899 },
      { term: "36 Months", class1: 1308, class2: 1536, class3: 1910 },
      { term: "48 Months", class1: 1325, class2: 1548, class3: 1939 },
      { term: "60 Months", class1: 1342, class2: 1561, class3: 1956 },
      { term: "72 Months", class1: 1362, class2: 1574, class3: 1975 },
      { term: "84 Months", class1: 1390, class2: 1591, class3: 1993 },
    ],
  },
];

export const coveredServices: CoveredService[] = [
  {
    name: "Tire/Wheel/Rim Repair and Replacement",
    description:
      "Provided that the damage is solely as a result of a road hazard, A-Protect will cover the reasonable costs incurred for the following services:",
    subItems: [
      "Flat Tire Replacement",
      "Tire Replacement (if rendered unserviceable)",
      "Wheels (Rims) repair or replacement if unable to seal with its tire",
      "Cosmetic Wheel Repair (for alloy wheels) due to damage from street curbs",
    ],
    tiers: ["essential", "extended", "superior"],
  },
  {
    name: "Tire/Wheel/Rim Mounting & Balancing",
    description:
      "For the covered tires under this Agreement, A-Protect will cover the costs of mounting, balancing, valve stems and tire disposal. Excludes: Shop supplies, unspecified charges.",
    tiers: ["essential", "extended", "superior"],
  },
  {
    name: "Roadside Coverage",
    description:
      "For the registered vehicle, A-Protect will reimburse the Customer up to $100.00 per occurrence for roadside assistance charges incurred for the following services:",
    subItems: [
      "Towing — To the nearest A-Protect Authorized Repair Facility or service centre capable of performing tire and rim repair/replacement services",
      "Winching",
      "Flat Tire Change (installation with inflated spare)",
      "Fuel Delivery (excludes the cost of fuel)",
      "Battery Boost",
      "Lockout services (excluding locksmith costs)",
    ],
    tiers: ["essential", "extended", "superior"],
  },
  {
    name: "Key & Remote Replacement",
    description:
      "If the original key is lost, stolen or destroyed, A-Protect will cover up to the maximum of $800.00 (per covered year) or $1,600.00 for the term maximum. All key replacements must be authorized by A-Protect and prior approval must be obtained before any replacements are made.",
    tiers: ["extended", "superior"],
  },
  {
    name: "Car Rental",
    description:
      "For covered mechanical breakdowns and if the repairs exceed one (1) business day, A-Protect will reimburse the Customer up to $70.00 per day (CAD). Prior approval must be obtained and valid receipts must be presented at the time of the claim.",
    tiers: ["extended", "superior"],
  },
  {
    name: "Windshield, Headlight & Tail Light Lens Repair",
    description:
      "For the repairs of minor chips and cracks for windshield, headlight and taillight lenses as a direct result of damage due to road objects, such as propelled rocks or debris (wood, metal pieces/parts).",
    tiers: ["superior"],
  },
  {
    name: "Paintless Dent Repair",
    description:
      "A-Protect will cover dent repairs up to 5 cm (centimetres) in diameter and scratches up to 30 cm in length on external body panels/parts due to damage caused as a direct result of public lot damage.",
    tiers: ["superior"],
  },
  {
    name: "Rip/Tear/Burn Puncture",
    description:
      "For the repair of accidental rips, tears, burns, or punctures up to 3 cm in length for the upholstered seats of the Covered vehicle.",
    tiers: ["superior"],
  },
];

export const roadsideCoverageConditions: string[] = [
  "Roadside coverage includes up to three (3) service calls within a twelve (12) month period.",
  "Limited to one (1) service call within a twenty-four (24) hour period.",
  "Valid receipts are required for reimbursement.",
];
