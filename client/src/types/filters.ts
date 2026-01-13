export interface Filters {
  make: string[];
  bodyStyle: string[];
  priceMin: number | null;
  priceMax: number | null;
  yearMin: number | null;
  yearMax: number | null;
  mileageMax: number | null;
  fuelType: string[];
  transmission: string[];
  sellerType: string[];
}
