import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import prisma from '../lib/prisma';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import { generateVehicleImage } from '../lib/aiImage';

const router = Router();

// Cleanup endpoint to remove default 'Automatic' and 'Gas' values
router.post('/cleanup-defaults', async (req, res) => {
  try {
    const result = await prisma.vehicle.updateMany({
      where: {
        OR: [
          { transmission: 'Automatic' },
          { fuelType: 'Gas' }
        ]
      },
      data: {
        transmission: '',
        fuelType: ''
      }
    });

    res.json({ 
      success: true, 
      message: `Updated ${result.count} vehicles to remove default values`,
      count: result.count 
    });
  } catch (error) {
    console.error('Error cleaning up defaults:', error);
    res.status(500).json({ error: 'Failed to cleanup defaults' });
  }
});

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads/vehicles');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config for images
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `vehicle-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// CSV upload middleware
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isCsv = file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv');
    const isExcel =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.toLowerCase().endsWith('.xlsx');

    if (isCsv || isExcel) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV or Excel (.xlsx) files are allowed'));
    }
  },
});

// Map abbreviated make names to full names
const makeNameMap: Record<string, string> = {
  'CHEV': 'Chevrolet',
  'DODG': 'Dodge',
  'CHRY': 'Chrysler',
  'MERB': 'Mercedes-Benz',
  'MITS': 'Mitsubishi',
  'NISN': 'Nissan',
  'TOYO': 'Toyota',
  'VOLK': 'Volkswagen',
  'GENE': 'Genesis',
  'INFI': 'Infiniti',
  'BUIC': 'Buick',
  'HYUN': 'Hyundai',
  'VOLV': 'Volvo',
  'MAZD': 'Mazda',
};

// Map abbreviated model names to full names
const modelNameMap: Record<string, string> = {
  // Chevrolet
  'EQUI': 'Equinox',
  'MALI': 'Malibu',
  'S2HC': 'Silverado 2500',
  'S15C': 'Silverado 1500',
  'TRAV': 'Traverse',
  'TAHO': 'Tahoe',
  'SUBU': 'Suburban',
  'COLO': 'Colorado',
  'BLAZ': 'Blazer',
  'TRAX': 'Trax',
  // Chrysler
  'GCAR': 'Grand Caravan',
  'PACI': 'Pacifica',
  '300': '300',
  // Dodge
  'CHAR': 'Charger',
  'CHAL': 'Challenger',
  'DURA': 'Durango',
  // Ford
  'BRON': 'Bronco',
  'ESCA': 'Escape',
  'EDGE': 'Edge',
  'EXPE': 'Expedition',
  'EXEL': 'Expedition Max',
  'EXPL': 'Explorer',
  'F15C': 'F-150',
  'F25C': 'F-250',
  'F35C': 'F-350',
  'T2MC': 'Transit 250',
  'T3MC': 'Transit 350',
  'RANG': 'Ranger',
  'MAVE': 'Maverick',
  // GMC
  'TERR': 'Terrain',
  'ACAD': 'Acadia',
  'YUKO': 'Yukon',
  'SIER': 'Sierra',
  'CANY': 'Canyon',
  // Hyundai
  'KONA': 'Kona',
  'TUCR': 'Tucson',
  'SANT': 'Santa Fe',
  'PALI': 'Palisade',
  'ELNT': 'Elantra',
  'SONA': 'Sonata',
  // Jeep
  'GCHE': 'Grand Cherokee',
  'GCWK': 'Grand Cherokee',
  'CHER': 'Cherokee',
  'WAGO': 'Wagoneer',
  'GRAN': 'Grand Wagoneer',
  'COMP': 'Compass',
  'WRAN': 'Wrangler',
  // Kia
  'CARN': 'Carnival',
  'SELT': 'Seltos',
  'SPORT': 'Sportage',
  'SORE': 'Sorento',
  'TELL': 'Telluride',
  // Mazda
  'CX5': 'CX-5',
  'CX50': 'CX-50',
  'CX70': 'CX-70',
  'CX90': 'CX-90',
  'MAZD3': 'Mazda3',
  'MAZD6': 'Mazda6',
  // Mercedes-Benz
  'CLA2': 'CLA 250',
  'GC30': 'GLC 300',
  'GCC3': 'GLC Coupe',
  'GLE3': 'GLE 350',
  'GLE4': 'GLE 450',
  'GLS4': 'GLS 450',
  // Mitsubishi
  'ECLX': 'Eclipse Cross',
  'RVR': 'RVR',
  'OUTL': 'Outlander',
  // Nissan
  'MURA': 'Murano',
  'ROGU': 'Rogue',
  'PATH': 'Pathfinder',
  'ARMA': 'Armada',
  'FRON': 'Frontier',
  'TITA': 'Titan',
  // Toyota
  'CAMR': 'Camry',
  'CAMH': 'Camry Hybrid',
  'CORO': 'Corolla',
  'RAV4': 'RAV4',
  '4RUN': '4Runner',
  'HIGH': 'Highlander',
  'SEQU': 'Sequoia',
  'TACR': 'Tacoma',
  'TUND': 'Tundra',
  // Volkswagen
  'TIGU': 'Tiguan',
  'ATLA': 'Atlas',
  'JETT': 'Jetta',
  'GOLF': 'Golf',
  'TUAR': 'Touareg',
  // Genesis
  'GV80': 'GV80',
  'GV70': 'GV70',
  'G70': 'G70',
  'G80': 'G80',
  'G90': 'G90',
  // Infiniti
  'QX60': 'QX60',
  'QX80': 'QX80',
  'QX50': 'QX50',
  'Q50': 'Q50',
};

const headerAliases: Record<string, string> = {
  unit_id: 'stock_number',
  unitid: 'stock_number',
  stocknumber: 'stock_number',
  stock_number: 'stock_number',
  stock: 'stock_number',
  kilometers: 'mileage',
  ext_color: 'exterior_color',
  extcolor: 'exterior_color',
  exteriorcolour: 'exterior_color',
  exteriorcolor: 'exterior_color',
  exterior_colour: 'exterior_color',
  interiorcolour: 'interior_color',
  interiorcolor: 'interior_color',
  bodystyle: 'body_style',
  modelyear: 'year',
  year_built: 'year',
  saleprice: 'price',
  selling_price: 'price',
  sellingprice: 'price',
  msrp: 'price',
  originalprice: 'original_price',
  purchase_price: 'original_price',
  purchaseprice: 'original_price',
  postalcode: 'postal_code',
  fueltype: 'fuel_type',
  drivetrain: 'drivetrain',
  equip: 'equipment',
  unit: 'unit',
};

const normalizeRow = (row: Record<string, any>) => {
  const normalized: Record<string, any> = {};

  Object.entries(row).forEach(([rawKey, rawValue]) => {
    if (!rawKey) return;

    const canonicalKey = rawKey
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    const mapKey = headerAliases[canonicalKey] || canonicalKey;
    const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue ?? '';

    normalized[mapKey] = value;
  });

  return normalized;
};

const cleanNumber = (value: any): number | null => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (!cleaned) return null;
    const parsed = parseFloat(cleaned);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const cleanInteger = (value: any): number | null => {
  if (typeof value === 'number') return Math.trunc(value);
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9]/g, '');
    if (!cleaned) return null;
    const parsed = parseInt(cleaned, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const toFeatureList = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => item.toString().trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

// Parse Premiere format "Unit" column: "2011 TOYOTA SIENNA - 1000"
// Returns { year, make, model } or null if parsing fails
const parsePremiereUnit = (unit: string | null | undefined): { year: number; make: string; model: string } | null => {
  if (!unit || typeof unit !== 'string') return null;
  
  // Format: "YEAR MAKE MODEL - STOCKNUM" or "YEAR MAKE MODEL"
  // Example: "2011 TOYOTA SIENNA - 1000" or "2018 RAM 1500 - 1005"
  const cleanUnit = unit.replace(/\s*-\s*\d+$/, '').trim(); // Remove " - STOCKNUM" part
  const parts = cleanUnit.split(/\s+/);
  
  if (parts.length < 3) return null;
  
  const yearStr = parts[0];
  const year = parseInt(yearStr, 10);
  if (Number.isNaN(year) || year < 1990 || year > new Date().getFullYear() + 2) return null;
  
  const make = parts[1];
  const model = parts.slice(2).join(' '); // Rest is the model (e.g., "SIENNA" or "F150" or "GRAND CARAVAN")
  
  return { year, make, model };
};

// Expand abbreviated make name
const expandMakeName = (make: string): string => {
  const upperMake = make.toUpperCase().trim();
  return makeNameMap[upperMake] || make;
};

// Expand abbreviated model name
const expandModelName = (model: string): string => {
  const upperModel = model.toUpperCase().trim();
  return modelNameMap[upperModel] || model;
};

// Parse equipment field to extract trim, drivetrain, body style, and description
const parseEquipmentField = (equipment: string | null | undefined, model?: string) => {
  if (!equipment) {
    return {
      trim: null,
      drivetrain: null,
      bodyStyle: null,
      description: null,
      features: [],
    };
  }

  const equipUpper = equipment.toUpperCase();
  const equipLower = equipment.toLowerCase();
  
  // Extract drivetrain
  let drivetrain: string | null = null;
  if (equipUpper.includes('AWD')) drivetrain = 'AWD';
  else if (equipUpper.includes('4WD') || equipUpper.includes('4X4')) drivetrain = '4WD';
  else if (equipUpper.includes('FWD')) drivetrain = 'FWD';
  else if (equipUpper.includes('RWD') || equipUpper.includes('2WD')) drivetrain = 'RWD';
  
  // Extract body style from equipment description OR model name
  let bodyStyle: string | null = null;
  const modelUpper = model?.toUpperCase() || '';
  
  // First try to find in equipment description
  if (equipUpper.includes('SEDAN')) bodyStyle = 'Sedan';
  else if (equipUpper.includes('SUV')) bodyStyle = 'SUV';
  else if (equipUpper.includes('COUPE')) bodyStyle = 'Coupe';
  else if (equipUpper.includes('TRUCK') || equipUpper.includes('CREW') || equipUpper.includes('PICKUP')) bodyStyle = 'Truck';
  else if (equipUpper.includes('VAN') || equipUpper.includes('CARGO') || equipUpper.includes('CARAVAN')) bodyStyle = 'Van';
  else if (equipUpper.includes('WAGON')) bodyStyle = 'Wagon';
  else if (equipUpper.includes('HATCHBACK')) bodyStyle = 'Hatchback';
  else if (equipUpper.includes('CONVERTIBLE')) bodyStyle = 'Convertible';
  
  // If not found, infer from model name
  if (!bodyStyle) {
    // Sedans
    if (['A3', 'A4', 'A6', 'A7', 'A8', 'MALI', 'MALIBU', 'CAMRY', 'ACCORD', 'CIVIC', 'SONATA', 'ELANTRA', 'ALTIMA', 'MAXIMA', 'CHAR', 'CHARGER', '3 SERIES', '5 SERIES'].includes(modelUpper)) {
      bodyStyle = 'Sedan';
    }
    // SUVs
    else if (['Q3', 'Q5', 'Q7', 'Q8', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'EQUI', 'EQUINOX', 'TRAV', 'TRAVERSE', 'BLAZ', 'BLAZER', 'TAHO', 'TAHOE', 'EDGE', 'ESCA', 'ESCAPE', 'EXPL', 'EXPLORER', 'EXPE', 'EXPEDITION', 'BRON', 'BRONCO', 'TERR', 'TERRAIN', 'ACAD', 'ACADIA', 'YUKO', 'YUKON', 'KONA', 'TUCS', 'TUCSON', 'SANT', 'SANTA', 'PALI', 'PALISADE', 'QX50', 'QX60', 'QX80', 'GCHE', 'COMPASS', 'RENE', 'RENEGADE', 'WRAN', 'WRANGLER', 'SELT', 'SELTOS', 'SORT', 'SORENTO', 'TELL', 'TELLURIDE', 'SPORT', 'SPORTAGE', 'GV70', 'GV80', 'CRV', 'CR-V', 'HRV', 'HR-V', 'PILOT', 'PASSPORT', 'RAV4', 'HIGH', 'HIGHLANDER', '4RUN', '4RUNNER'].includes(modelUpper)) {
      bodyStyle = 'SUV';
    }
    // Trucks
    else if (['F15', 'F-15', 'F150', 'F-150', 'F25', 'F-25', 'F250', 'F-250', 'F35', 'F-35', 'F350', 'F-350', 'F45', 'F450', 'S15', 'SILV', 'SILVERADO', 'S25', 'S35', 'SIERRA', 'RAM', 'TUND', 'TUNDRA', 'TACO', 'TACOMA', 'TITAN', 'FRONT', 'FRONTIER'].includes(modelUpper)) {
      bodyStyle = 'Truck';
    }
    // Vans
    else if (['TRAN', 'TRANSIT', 'GCAR', 'CARAVAN', 'PACI', 'PACIFICA', 'ODYS', 'ODYSSEY', 'SIEN', 'SIENNA', 'CARN', 'CARNIVAL'].includes(modelUpper)) {
      bodyStyle = 'Van';
    }
    // Coupes
    else if (['MUST', 'MUSTANG', 'CAMA', 'CAMARO', 'CHAL', 'CHALLENGER', 'CORV', 'CORVETTE', 'TT', 'A5', 'M2', 'M4', '2 SERIES', '4 SERIES', '8 SERIES'].includes(modelUpper)) {
      bodyStyle = 'Coupe';
    }
  }

  // Extract features from common keywords
  const features: string[] = [];
  if (equipUpper.includes('ROOF') || equipUpper.includes('SUNROOF') || equipUpper.includes('MOONROOF')) {
    features.push('Sunroof');
  }
  if (equipUpper.includes('NAV') || equipUpper.includes('NAVIGATION')) {
    features.push('Navigation');
  }
  if (equipUpper.includes('LTHR') || equipUpper.includes('LEATHER')) {
    features.push('Leather Interior');
  }
  if (equipUpper.includes('HEATED')) {
    features.push('Heated Seats');
  }
  if (equipUpper.includes('PREMIUM') || equipUpper.includes('PREM')) {
    features.push('Premium Package');
  }

  // Extract trim (first segment usually contains trim level)
  const trimMatch = equipment.match(/^([A-Z0-9\s]+?)(?:\s+AWD|\s+4WD|\s+FWD|\s+RWD|$)/i);
  const trim = trimMatch ? trimMatch[1].trim() : null;

  // Create a clean description
  const description = `${equipment.trim()} - Well maintained vehicle with quality features`;

  return {
    trim,
    drivetrain,
    bodyStyle,
    description,
    features,
  };
};

// GET all vehicles (public)
router.get('/', async (req, res) => {
  try {
    const { search, make, minPrice, maxPrice, minYear, maxYear, bodyStyle, status, inventoryType, sortBy, sortOrder, limit } = req.query;

    const where: any = {};

    if (status) {
      where.status = status;
    } else {
      where.status = 'ACTIVE';
    }

    if (inventoryType) {
      where.inventoryType = inventoryType;
    }

    if (search) {
      where.OR = [
        { make: { contains: search as string, mode: 'insensitive' } },
        { model: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (make) where.make = { equals: make as string, mode: 'insensitive' };
    if (minPrice) where.price = { ...where.price, gte: parseFloat(minPrice as string) };
    if (maxPrice) where.price = { ...where.price, lte: parseFloat(maxPrice as string) };
    if (minYear) where.year = { ...where.year, gte: parseInt(minYear as string) };
    if (maxYear) where.year = { ...where.year, lte: parseInt(maxYear as string) };
    if (bodyStyle) where.bodyStyle = { equals: bodyStyle as string, mode: 'insensitive' };

    // If status filter is provided, validate it's a valid enum value
    if (status) {
      where.status = status as any;
    }

    // Build orderBy based on query params
    let orderBy: any = [{ featured: 'desc' }, { createdAt: 'desc' }];
    if (sortBy) {
      const order = sortOrder === 'asc' ? 'asc' : 'desc';
      orderBy = [{ [sortBy as string]: order }];
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy,
      take: limit ? parseInt(limit as string) : undefined,
    });

    res.json(vehicles);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

// GET single vehicle
router.get('/:id', async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: req.params.id },
    });

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    res.json(vehicle);
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
});

// POST create vehicle (admin)
router.post('/', upload.array('images', 20), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    const images = files?.map((f) => `/uploads/vehicles/${f.filename}`) || [];

    const {
      make, model, year, trim, vin, price, originalPrice,
      mileage, exteriorColor, interiorColor, transmission,
      drivetrain, fuelType, bodyStyle, description, features,
      city, province, postalCode, featured, inventoryType, stockNumber,
    } = req.body;

    // Determine stock number - auto-generate F#### for Fleet if not provided
    let finalStockNumber = stockNumber?.trim() || null;
    const vehicleInventoryType = inventoryType === 'PREMIERE' ? 'PREMIERE' : 'FLEET';
    
    if (vehicleInventoryType === 'FLEET' && !finalStockNumber) {
      // Find the highest existing F#### stock number
      const fleetVehicles = await prisma.vehicle.findMany({
        where: {
          stockNumber: {
            startsWith: 'F',
          },
        },
        select: { stockNumber: true },
      });
      
      let nextNum = 1000;
      for (const v of fleetVehicles) {
        if (v.stockNumber) {
          const match = v.stockNumber.match(/^F(\d+)$/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num >= nextNum) {
              nextNum = num + 1;
            }
          }
        }
      }
      finalStockNumber = `F${nextNum}`;
    }

    // Parse features
    let featuresArray: string[] = [];
    if (features) {
      featuresArray = typeof features === 'string'
        ? features.split('|').map((f: string) => f.trim()).filter(Boolean)
        : features;
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        make,
        model,
        year: parseInt(year),
        trim: trim || null,
        vin: vin.toUpperCase(),
        stockNumber: finalStockNumber,
        price: parseFloat(price),
        originalPrice: originalPrice ? parseFloat(originalPrice) : null,
        mileage: parseInt(mileage) || 0,
        exteriorColor,
        interiorColor: interiorColor || null,
        transmission,
        drivetrain: drivetrain || null,
        fuelType,
        bodyStyle,
        description: description || null,
        features: featuresArray,
        images,
        city,
        province,
        postalCode: postalCode || null,
        featured: featured === 'true',
        inventoryType: vehicleInventoryType,
      },
    });

    res.status(201).json(vehicle);
  } catch (error: any) {
    console.error('Error creating vehicle:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Vehicle with this VIN already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create vehicle' });
    }
  }
});

// PUT update vehicle
router.put('/:id', upload.array('images', 20), async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];
    const newImages = files?.map((f) => `/uploads/vehicles/${f.filename}`) || [];

    const existingVehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!existingVehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const {
      make, model, year, trim, vin, price, originalPrice,
      mileage, exteriorColor, interiorColor, transmission,
      drivetrain, fuelType, bodyStyle, description, features,
      city, province, postalCode, featured, status, existingImages,
    } = req.body;

    // Combine existing and new images
    let allImages = existingVehicle.images;
    if (existingImages) {
      allImages = typeof existingImages === 'string' ? JSON.parse(existingImages) : existingImages;
    }
    allImages = [...allImages, ...newImages];

    // Parse features
    let featuresArray: string[] = existingVehicle.features;
    if (features) {
      featuresArray = typeof features === 'string'
        ? features.split('|').map((f: string) => f.trim()).filter(Boolean)
        : features;
    }

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        make: make || existingVehicle.make,
        model: model || existingVehicle.model,
        year: year ? parseInt(year) : existingVehicle.year,
        trim: trim !== undefined ? trim : existingVehicle.trim,
        vin: vin ? vin.toUpperCase() : existingVehicle.vin,
        price: price ? parseFloat(price) : existingVehicle.price,
        originalPrice: originalPrice ? parseFloat(originalPrice) : existingVehicle.originalPrice,
        mileage: mileage ? parseInt(mileage) : existingVehicle.mileage,
        exteriorColor: exteriorColor || existingVehicle.exteriorColor,
        interiorColor: interiorColor !== undefined ? interiorColor : existingVehicle.interiorColor,
        transmission: transmission || existingVehicle.transmission,
        drivetrain: drivetrain !== undefined ? drivetrain : existingVehicle.drivetrain,
        fuelType: fuelType || existingVehicle.fuelType,
        bodyStyle: bodyStyle || existingVehicle.bodyStyle,
        description: description !== undefined ? description : existingVehicle.description,
        features: featuresArray,
        images: allImages,
        city: city || existingVehicle.city,
        province: province || existingVehicle.province,
        postalCode: postalCode !== undefined ? postalCode : existingVehicle.postalCode,
        featured: featured !== undefined ? featured === 'true' : existingVehicle.featured,
        status: status || existingVehicle.status,
      },
    });

    res.json(vehicle);
  } catch (error) {
    console.error('Error updating vehicle:', error);
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

// PATCH /:id - Quick update for specific fields (status, images order, etc.)
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    // Only allow specific fields to be updated via PATCH
    const allowedFields = ['status', 'images', 'featured'];
    const filteredUpdates: any = {};
    
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    const updatedVehicle = await prisma.vehicle.update({
      where: { id },
      data: filteredUpdates,
    });

    res.json(updatedVehicle);
  } catch (error) {
    console.error('Error updating vehicle:', error);
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

// DELETE vehicle
router.delete('/:id', async (req, res) => {
  try {
    await prisma.vehicle.delete({ where: { id: req.params.id } });
    res.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

// POST upload photos to existing vehicle
router.post('/:id/photos', upload.array('photos', 20), async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No photos provided' });
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const newPhotos = files.map((f) => `/uploads/vehicles/${f.filename}`);
    const updatedImages = [...vehicle.images, ...newPhotos];

    const updatedVehicle = await prisma.vehicle.update({
      where: { id },
      data: { images: updatedImages },
    });

    res.json({
      message: `${newPhotos.length} photo(s) uploaded successfully`,
      photos: newPhotos,
      totalPhotos: updatedImages.length,
      vehicle: updatedVehicle,
    });
  } catch (error) {
    console.error('Error uploading photos:', error);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

// DELETE photo from vehicle
router.delete('/:id/photos', async (req, res) => {
  try {
    const { id } = req.params;
    const { photoPath } = req.body;

    if (!photoPath) {
      return res.status(400).json({ error: 'Photo path is required' });
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    // Remove from database array
    const updatedImages = vehicle.images.filter((img) => img !== photoPath);

    // Delete physical file
    const filename = photoPath.split('/').pop();
    if (filename) {
      const filePath = path.join(uploadDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted file: ${filePath}`);
      }
    }

    // Update vehicle
    const updatedVehicle = await prisma.vehicle.update({
      where: { id },
      data: { images: updatedImages },
    });

    res.json({
      message: 'Photo deleted successfully',
      vehicle: updatedVehicle,
    });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// POST bulk import CSV / Excel
router.post('/import/csv', csvUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Get inventory type from form data (default to FLEET)
    const inventoryType = req.body.inventoryType === 'PREMIERE' ? 'PREMIERE' : 'FLEET';

    // For Fleet vehicles, get the next stock number starting from F1000
    let nextFleetStockNumber = 1000;
    if (inventoryType === 'FLEET') {
      const highestFleetStock = await prisma.vehicle.findMany({
        where: {
          stockNumber: {
            startsWith: 'F',
          },
        },
        select: { stockNumber: true },
      });
      
      for (const v of highestFleetStock) {
        if (v.stockNumber) {
          const match = v.stockNumber.match(/^F(\d+)$/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num >= nextFleetStockNumber) {
              nextFleetStockNumber = num + 1;
            }
          }
        }
      }
    }

    const originalName = req.file.originalname.toLowerCase();
    const isExcel = originalName.endsWith('.xlsx');

    let rawRecords: any[] = [];

    try {
      if (isExcel) {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        rawRecords = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      } else {
        const csvContent = req.file.buffer.toString('utf-8');
        rawRecords = parse(csvContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
      }
    } catch (parseError) {
      console.error('Bulk import parse error:', parseError);
      return res.status(400).json({ error: 'Unable to parse file. Please verify the template.' });
    }

    if (!rawRecords.length) {
      return res.status(400).json({ error: 'No rows found in uploaded file' });
    }

    const records = rawRecords.map((row) => normalizeRow(row));

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // header row adjustment

      try {
        // Try to parse Premiere format "Unit" column if present
        // Format: "2011 TOYOTA SIENNA - 1000"
        let yearValue: number | null = null;
        let make: string | null = null;
        let model: string | null = null;
        let stockNumberFromUnit: string | null = null;
        
        if (row.unit && typeof row.unit === 'string') {
          // Premiere format: parse the Unit column
          const premiereData = parsePremiereUnit(row.unit);
          if (premiereData) {
            yearValue = premiereData.year;
            make = expandMakeName(premiereData.make);
            model = premiereData.model; // Already full name in Premiere format
          }
          // Extract stock number from unit if not in separate column
          const stockMatch = row.unit.match(/-\s*(\d+)$/);
          if (stockMatch) {
            stockNumberFromUnit = stockMatch[1];
          }
        }
        
        // Fall back to standard columns if not Premiere format
        if (!make) {
          const rawMake = row.make?.toString().trim();
          make = rawMake ? expandMakeName(rawMake) : null;
        }
        if (!model) {
          const rawModel = row.model?.toString().trim();
          model = rawModel ? expandModelName(rawModel) : null;
        }
        if (!yearValue) {
          yearValue = cleanInteger(row.year);
        }

        // For Premiere format without VIN, generate a placeholder VIN
        let vin = row.vin?.toString().toUpperCase().trim();
        const isPremiereFormat = !!row.unit;
        
        if (!vin && isPremiereFormat) {
          // Generate a unique VIN for Premiere cars that don't have one
          // Format: EDC + stock number + random chars to make it unique
          const stockNum = row.stock_number?.toString().replace(/^P/i, '') || stockNumberFromUnit || Date.now().toString();
          vin = `EDCPREMIERE${stockNum}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        }
        
        if (!vin) {
          results.push({ success: false, row: rowNum, vin: 'N/A', error: 'Missing VIN' });
          failCount++;
          continue;
        }

        if (!make || !model || !yearValue) {
          results.push({ success: false, row: rowNum, vin, error: 'Missing make, model, or year' });
          failCount++;
          continue;
        }

        // Check for duplicate VIN
        const existing = await prisma.vehicle.findUnique({ where: { vin } });
        if (existing) {
          results.push({ success: false, row: rowNum, vin, error: 'VIN already exists' });
          failCount++;
          continue;
        }

        const price = cleanNumber(row.price);
        const mileage = cleanInteger(row.mileage) ?? 0;
        if (price === null) {
          results.push({ success: false, row: rowNum, vin, error: 'Invalid price' });
          failCount++;
          continue;
        }

        // Parse equipment field for detailed information
        const equipmentData = parseEquipmentField(row.equipment, model);
        
        // Merge features from both sources
        const csvFeatures = toFeatureList(row.features);
        const allFeatures = [...new Set([...equipmentData.features, ...csvFeatures])];

        // Get stock number - for Fleet use F#### format, for Premiere use existing or extracted
        let stockNumber: string | null = null;
        if (inventoryType === 'FLEET') {
          // Auto-generate F#### stock number for fleet vehicles
          stockNumber = `F${nextFleetStockNumber}`;
          nextFleetStockNumber++;
        } else {
          // For Premiere, use stock_number column or extracted from Unit column
          stockNumber = row.stock_number?.toString().trim() || stockNumberFromUnit || null;
        }
        
        // Get trim - for Premiere format, trim comes from separate Trim column
        const trim = row.trim?.toString().trim() || equipmentData.trim || null;
        
        // Parse drivetrain from Premiere trim field (e.g., "V6 7-PASSENGER FWD" contains "FWD")
        let drivetrain = equipmentData.drivetrain || row.drivetrain?.toString().trim() || null;
        if (!drivetrain && trim) {
          const trimUpper = trim.toUpperCase();
          if (trimUpper.includes('AWD')) drivetrain = 'AWD';
          else if (trimUpper.includes('4WD') || trimUpper.includes('4X4')) drivetrain = '4WD';
          else if (trimUpper.includes('FWD')) drivetrain = 'FWD';
          else if (trimUpper.includes('RWD') || trimUpper.includes('2WD')) drivetrain = 'RWD';
        }

        // Parse body style from model name for Premiere format
        let bodyStyle = equipmentData.bodyStyle || row.body_style?.toString().trim() || '';
        if (!bodyStyle && model) {
          const modelUpper = model.toUpperCase();
          if (modelUpper.includes('SIENNA') || modelUpper.includes('ODYSSEY') || modelUpper.includes('PACIFICA') || modelUpper.includes('CARAVAN')) {
            bodyStyle = 'Minivan';
          } else if (modelUpper.includes('F150') || modelUpper.includes('F-150') || modelUpper.includes('SILVERADO') || modelUpper.includes('RAM') || modelUpper.includes('SIERRA') || modelUpper.includes('TACOMA') || modelUpper.includes('TUNDRA') || modelUpper.includes('FRONTIER') || modelUpper.includes('RANGER') || modelUpper.includes('COLORADO') || modelUpper.includes('CANYON')) {
            bodyStyle = 'Truck';
          } else if (modelUpper.includes('TUCSON') || modelUpper.includes('SORENTO') || modelUpper.includes('PATHFINDER') || modelUpper.includes('PILOT') || modelUpper.includes('HIGHLANDER') || modelUpper.includes('EXPLORER') || modelUpper.includes('JOURNEY') || modelUpper.includes('EQUINOX') || modelUpper.includes('ESCAPE') || modelUpper.includes('RAV4') || modelUpper.includes('CR-V') || modelUpper.includes('ROGUE')) {
            bodyStyle = 'SUV';
          } else if (modelUpper.includes('JETTA') || modelUpper.includes('CIVIC') || modelUpper.includes('COROLLA') || modelUpper.includes('CAMRY') || modelUpper.includes('ACCORD') || modelUpper.includes('ELANTRA') || modelUpper.includes('SONATA')) {
            bodyStyle = 'Sedan';
          } else if (modelUpper.includes('LEAF')) {
            bodyStyle = 'Hatchback';
          }
        }

        await prisma.vehicle.create({
          data: {
            make,
            model,
            year: yearValue,
            trim,
            vin,
            stockNumber,
            series: row.series?.toString().trim() || null,
            equipment: row.equipment?.toString().trim() || null,
            price,
            originalPrice: cleanNumber(row.original_price),
            mileage,
            exteriorColor: row.exterior_color?.toString().trim() || '',
            interiorColor: row.interior_color?.toString().trim() || null,
            transmission: row.transmission?.toString().trim() || '',
            drivetrain,
            fuelType: row.fuel_type?.toString().trim() || '',
            bodyStyle,
            description: equipmentData.description || row.description?.toString().trim() || '',
            features: allFeatures,
            city: row.city?.toString().trim() || 'Toronto',
            province: row.province?.toString().trim() || 'ON',
            postalCode: row.postal_code?.toString().trim() || null,
            images: [], // No AI images during import
            status: 'ACTIVE',
            inventoryType: inventoryType,
          },
        });

        results.push({ success: true, row: rowNum, vin, make, model });
        successCount++;
      } catch (rowError: any) {
        results.push({ success: false, row: rowNum, vin: row.vin || 'N/A', error: rowError.message });
        failCount++;
      }
    }

    res.json({
      message: `Import completed: ${successCount} successful, ${failCount} failed`,
      summary: { total: records.length, successful: successCount, failed: failCount },
      results,
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: 'Server error during bulk import' });
  }
});

// GET CSV template
router.get('/template/csv', (req, res) => {
  const template = `stock_number,make,model,year,series,trim,vin,price,original_price,mileage,exterior_color,interior_color,transmission,drivetrain,fuel_type,body_style,equipment,description,features,city,province,postal_code
8FDJTG,AUDI,A3,2024,40K4,,WAUGUCGY2RA065548,29100,,78215,SILVER,,Automatic,AWD,Gas,Sedan,A3 40 KOMFORT AWD SEDAN,Well maintained luxury sedan,Backup Camera|Bluetooth|Apple CarPlay|Heated Seats,Toronto,Ontario,M5V 1A1
8FHHCD,BMW,X3,2023,30AE,,5UX53DP01P9R92681,32100,,88134,WHITE,,Automatic,AWD,Gas,SUV,X3 30I XDRIVE AWD W/PREMPKG ESSEN,Premium SUV with excellent features,Sunroof|Lane Assist|Android Auto|Leather Interior,Vancouver,British Columbia,V6B 2W2`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=vehicle_import_template.csv');
  res.send(template);
});

// POST generate AI image for single vehicle
router.post('/:id/generate-image', async (req, res) => {
  try {
    const { id } = req.params;
    const vehicle = await prisma.vehicle.findUnique({ where: { id } });

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    // Try Gemini first, fall back to OpenAI if it fails
    let aiImagePath = await generateVehicleImage({
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      bodyStyle: vehicle.bodyStyle,
      color: vehicle.exteriorColor,
    }, 'gemini');

    // Fallback to OpenAI if Gemini fails
    if (!aiImagePath) {
      console.log('⚠️ Gemini failed, trying OpenAI fallback...');
      aiImagePath = await generateVehicleImage({
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        bodyStyle: vehicle.bodyStyle,
        color: vehicle.exteriorColor,
      }, 'openai');
    }

    if (!aiImagePath) {
      return res.status(500).json({ error: 'Failed to generate AI image with both Gemini and OpenAI. Check server logs.' });
    }

    // Add AI image to the beginning of images array
    const updatedImages = [aiImagePath, ...vehicle.images];
    const updatedVehicle = await prisma.vehicle.update({
      where: { id },
      data: { images: updatedImages },
    });

    res.json({
      message: 'AI image generated successfully',
      image: aiImagePath,
      vehicle: updatedVehicle,
    });
  } catch (error) {
    console.error('Error generating AI image:', error);
    res.status(500).json({ error: 'Failed to generate AI image' });
  }
});

// POST bulk generate AI images
router.post('/generate-images/bulk', async (req, res) => {
  try {
    const { vehicleIds } = req.body;

    if (!vehicleIds || !Array.isArray(vehicleIds) || vehicleIds.length === 0) {
      return res.status(400).json({ error: 'Vehicle IDs array is required' });
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const id of vehicleIds) {
      try {
        const vehicle = await prisma.vehicle.findUnique({ where: { id } });

        if (!vehicle) {
          results.push({ id, status: 'error', message: 'Vehicle not found' });
          failCount++;
          continue;
        }

        // Try Gemini first, fall back to OpenAI if it fails
        let aiImagePath = await generateVehicleImage({
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          bodyStyle: vehicle.bodyStyle,
          color: vehicle.exteriorColor,
        }, 'gemini');

        // Fallback to OpenAI if Gemini fails
        if (!aiImagePath) {
          console.log(`⚠️ Gemini failed for vehicle ${id}, trying OpenAI fallback...`);
          aiImagePath = await generateVehicleImage({
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            bodyStyle: vehicle.bodyStyle,
            color: vehicle.exteriorColor,
          }, 'openai');
        }

        if (!aiImagePath) {
          results.push({ id, status: 'error', message: 'AI generation failed with both Gemini and OpenAI' });
          failCount++;
          continue;
        }

        // Add AI image to the beginning of images array
        const updatedImages = [aiImagePath, ...vehicle.images];
        await prisma.vehicle.update({
          where: { id },
          data: { images: updatedImages },
        });

        results.push({ 
          id, 
          status: 'success', 
          image: aiImagePath,
          vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`
        });
        successCount++;
      } catch (error) {
        console.error(`Error generating AI image for vehicle ${id}:`, error);
        results.push({ id, status: 'error', message: 'Generation failed' });
        failCount++;
      }
    }

    res.json({
      message: `Bulk generation completed: ${successCount} successful, ${failCount} failed`,
      summary: { total: vehicleIds.length, successful: successCount, failed: failCount },
      results,
    });
  } catch (error) {
    console.error('Bulk AI generation error:', error);
    res.status(500).json({ error: 'Server error during bulk AI generation' });
  }
});

// POST import Premiere CSV (specific format)
router.post('/import/premiere', csvUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const rawRecords = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (!rawRecords.length) {
      return res.status(400).json({ error: 'No rows found in CSV file' });
    }

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < rawRecords.length; i++) {
      const row = rawRecords[i];
      const rowNum = i + 2;

      try {
        // Parse Unit field (e.g., "2011 TOYOTA SIENNA - 1000")
        const unit = row['Unit']?.toString().trim();
        if (!unit) {
          results.push({ success: false, row: rowNum, error: 'Missing Unit field' });
          failCount++;
          continue;
        }

        // Extract year, make, model from Unit
        const unitMatch = unit.match(/^(\d{4})\s+([A-Z\s]+?)\s+([A-Z0-9\s]+?)\s*-\s*\d+$/i);
        if (!unitMatch) {
          results.push({ success: false, row: rowNum, unit, error: 'Unable to parse Unit format' });
          failCount++;
          continue;
        }

        const year = parseInt(unitMatch[1]);
        const make = unitMatch[2].trim();
        const model = unitMatch[3].trim();

        // Get stock number
        const stockNumber = row['Stock']?.toString().trim();
        if (!stockNumber) {
          results.push({ success: false, row: rowNum, unit, error: 'Missing Stock number' });
          failCount++;
          continue;
        }

        // Generate placeholder VIN
        const vin = `PREMIERE-${stockNumber}`;

        // Check for duplicate VIN or stock number
        const existing = await prisma.vehicle.findFirst({
          where: {
            OR: [
              { vin },
              { stockNumber }
            ]
          }
        });

        if (existing) {
          results.push({ success: false, row: rowNum, stockNumber, error: 'Vehicle already exists' });
          failCount++;
          continue;
        }

        // Parse price (remove $ and commas)
        const priceStr = row['Selling Price']?.toString().replace(/[$,]/g, '').trim();
        const price = parseFloat(priceStr);
        if (isNaN(price)) {
          results.push({ success: false, row: rowNum, stockNumber, error: 'Invalid price' });
          failCount++;
          continue;
        }

        // Parse mileage (remove "KM" and commas)
        const mileageStr = row['Mileage']?.toString().replace(/[,KM\s]/gi, '').trim();
        const mileage = parseInt(mileageStr) || 0;

        // Get trim
        const trim = row['Trim']?.toString().trim() || null;

        // Parse drivetrain and transmission from trim
        let drivetrain: string | null = null;
        let transmission = 'Automatic';
        
        if (trim) {
          const trimUpper = trim.toUpperCase();
          if (trimUpper.includes('AWD')) drivetrain = 'AWD';
          else if (trimUpper.includes('4WD') || trimUpper.includes('4X4')) drivetrain = '4WD';
          else if (trimUpper.includes('FWD')) drivetrain = 'FWD';
          else if (trimUpper.includes('RWD') || trimUpper.includes('2WD')) drivetrain = 'RWD';
          
          if (trimUpper.includes('MANUAL')) transmission = 'Manual';
        }

        // Create vehicle
        await prisma.vehicle.create({
          data: {
            make,
            model,
            year,
            trim,
            vin,
            stockNumber,
            price,
            mileage,
            exteriorColor: 'Contact for details',
            transmission,
            drivetrain,
            fuelType: 'Contact for details',
            bodyStyle: 'Contact for details',
            description: `${year} ${make} ${model}${trim ? ` ${trim}` : ''}`,
            features: [],
            city: 'Toronto',
            province: 'ON',
            status: 'ACTIVE',
            inventoryType: 'PREMIERE',
            images: [],
          },
        });

        results.push({ success: true, row: rowNum, stockNumber, make, model, year });
        successCount++;
      } catch (error: any) {
        console.error(`Error processing Premiere row ${rowNum}:`, error);
        results.push({ success: false, row: rowNum, error: error.message });
        failCount++;
      }
    }

    res.json({
      success: true,
      message: `Imported ${successCount} Premiere vehicles successfully, ${failCount} failed`,
      summary: { total: rawRecords.length, successful: successCount, failed: failCount },
      results,
    });
  } catch (error) {
    console.error('Premiere CSV import error:', error);
    res.status(500).json({ error: 'Failed to import Premiere CSV' });
  }
});

export default router;
