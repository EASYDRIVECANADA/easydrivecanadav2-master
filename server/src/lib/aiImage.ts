import path from 'path'
import fs from 'fs'

const uploadDir = path.join(__dirname, '../../uploads/vehicles')

// Map abbreviated make names to full names for better AI generation
const makeNameMap: Record<string, string> = {
  'CHEV': 'Chevrolet',
  'CHEVY': 'Chevrolet',
  'CHRY': 'Chrysler',
  'DODG': 'Dodge',
  'CADI': 'Cadillac',
  'MERB': 'Mercedes-Benz',
  'MERC': 'Mercedes-Benz',
  'MERCEDES': 'Mercedes-Benz',
  'BENZ': 'Mercedes-Benz',
  'VOLK': 'Volkswagen',
  'VOLKS': 'Volkswagen',
  'VW': 'Volkswagen',
  'INFI': 'Infiniti',
  'LEXU': 'Lexus',
  'ACUR': 'Acura',
  'LINC': 'Lincoln',
  'HYUN': 'Hyundai',
  'JAGU': 'Jaguar',
  'LAND': 'Land Rover',
  'RANGE': 'Range Rover',
  'ALFA': 'Alfa Romeo',
  'ASTON': 'Aston Martin',
  'ROLLS': 'Rolls-Royce',
  'MASE': 'Maserati',
  'LAMB': 'Lamborghini',
  'FERR': 'Ferrari',
  'BENT': 'Bentley',
  'BUGAT': 'Bugatti',
  'MITS': 'Mitsubishi',
  'MITSUB': 'Mitsubishi',
  'SUBA': 'Subaru',
  'MAZD': 'Mazda',
  'NISS': 'Nissan',
  'NISN': 'Nissan',
  'TOYO': 'Toyota',
  'HOND': 'Honda',
  'PONT': 'Pontiac',
  'SATUR': 'Saturn',
  'OLDS': 'Oldsmobile',
  'PLYM': 'Plymouth',
  'BUIC': 'Buick',
  'GMC': 'GMC',
  'KIA': 'Kia',
  'TESL': 'Tesla',
  'GENE': 'Genesis',
  'VOLV': 'Volvo',
  'RAM': 'Ram',
}

// Expand abbreviated model names
const modelNameMap: Record<string, string> = {
  // Chevrolet models
  'MALI': 'Malibu',
  'EQUI': 'Equinox',
  'TRAV': 'Traverse',
  'TAHO': 'Tahoe',
  'SILV': 'Silverado',
  'S2HC': 'Silverado 2500',
  'S1HC': 'Silverado 1500',
  'COLO': 'Colorado',
  'BLAZ': 'Blazer',
  'SUBU': 'Suburban',
  'CAMA': 'Camaro',
  'CORV': 'Corvette',
  
  // Dodge/Chrysler models
  'CHAR': 'Charger',
  'CHAL': 'Challenger',
  'DURA': 'Durango',
  'CARA': 'Caravan',
  'GCAR': 'Grand Caravan',
  'PACI': 'Pacifica',
  
  // Ford models
  'BRON': 'Bronco',
  'ESCA': 'Escape',
  'EXPE': 'Expedition',
  'EXPL': 'Explorer',
  'RANG': 'Ranger',
  'MUST': 'Mustang',
  'F15C': 'F-150',
  'F25C': 'F-250',
  'F35C': 'F-350',
  'F15E': 'F-150',
  'T2MC': 'Transit 250',
  'EXEL': 'Expedition Max',
  
  // Toyota models
  'CAME': 'Camry',
  'CAMR': 'Camry',
  'CAMH': 'Camry Hybrid',
  'CORO': 'Corolla',
  'HIGH': 'Highlander',
  'TUND': 'Tundra',
  'TACO': 'Tacoma',
  '4RUN': '4Runner',
  'SIEN': 'Sienna',
  'PRIU': 'Prius',
  
  // Honda models
  'ACCO': 'Accord',
  'CIVI': 'Civic',
  'PILO': 'Pilot',
  'RIDG': 'Ridgeline',
  'ODYS': 'Odyssey',
  'CR-V': 'CR-V',
  'HR-V': 'HR-V',
  
  // Nissan models
  'MURA': 'Murano',
  'ROGU': 'Rogue',
  'VERS': 'Versa',
  'KICK': 'Kicks',
  'ARMA': 'Armada',
  
  // GMC models
  'TERR': 'Terrain',
  
  // Hyundai models
  'KONA': 'Kona',
  
  // Jeep models
  'GCHE': 'Grand Cherokee',
  'GCWK': 'Grand Cherokee WK',
  'WAGO': 'Wagoneer',
  
  // Kia models
  'CARN': 'Carnival',
  'SELT': 'Seltos',
  'SPOR': 'Sportage',
  
  // Mazda models
  'CX5': 'CX-5',
  'CX70': 'CX-70',
  'CX90': 'CX-90',
  
  // Mercedes models
  'CLA2': 'CLA 250',
  'GC30': 'GLC 300',
  'GCC3': 'GLC 300 Coupe',
  'GLA': 'GLA',
  
  // Mitsubishi models
  'ECLX': 'Eclipse Cross',
  'RVR': 'RVR',
  
  // Genesis models
  'GV80': 'GV80',
  
  // Infiniti models
  'QX60': 'QX60',
  'QX80': 'QX80',
  
  // Buick models
  'ENVI': 'Envision',
  
  // Volkswagen models
  'TIGU': 'Tiguan',
  'ATLA': 'Atlas',
  
  // Volvo models
  'XC40': 'XC40',
  
  // Ram models
  'B25C': '2500',
  'C15C': '1500',
}

const expandMakeName = (make: string): string => {
  const upper = make.toUpperCase().trim()
  return makeNameMap[upper] || make
}

const expandModelName = (model: string): string => {
  const upper = model.toUpperCase().trim()
  return modelNameMap[upper] || model
}

export async function generateVehicleImage(
  options: {
    make: string
    model: string
    year: number
    bodyStyle?: string | null
    color?: string | null
  },
  provider: 'gemini' | 'openai' = 'gemini'
) {
  // Expand abbreviated names for better AI understanding
  const fullMake = expandMakeName(options.make)
  const fullModel = expandModelName(options.model)

  // Optimized prompt following automotive photography standards
  const colorText = options.color ? ` in ${options.color}` : ''
  const bodyText = options.bodyStyle ? ` ${options.bodyStyle}` : ''
  
  // Improved prompt with anti-hallucination measures
  const prompt = `Photograph of a REAL ${options.year} ${fullMake} ${fullModel}${bodyText}${colorText}. 
THIS IS A REAL EXISTING PRODUCTION CAR - generate the actual vehicle as sold at dealerships, not a concept or fictional design.
ACCURACY: Must match the real ${options.year} ${fullMake} ${fullModel} exactly as manufactured - correct grille, headlights, body shape, wheels, and proportions.
COMPOSITION: Car must be LARGE and PROMINENT, filling most of the frame. The vehicle should appear close to the camera, not far away. However, the ENTIRE car must be visible - all 4 wheels, full front bumper to rear bumper, roof to ground. Minimal empty space but no cropping.
ANGLE: 3/4 front view, eye-level camera angle, similar to official manufacturer press photos.
BACKGROUND: Clean neutral light gray seamless studio backdrop.
LIGHTING: Soft balanced studio lighting, natural colors, no overexposure.
REALISM: Photo taken with professional DSLR camera, looks like a real photograph, not CGI or rendering.
DO NOT: No futuristic designs, no concept cars, no alien styling, no made-up features, no exaggerated proportions, no fantasy elements.
DO NOT: No text, no watermarks, no logos, no people, no other vehicles.
DO NOT: Never crop or cut off any part of the vehicle - all parts must be visible.`

  if (provider === 'gemini') {
    return await generateWithGemini(prompt, fullMake, fullModel, options.year)
  } else {
    return await generateWithOpenAI(prompt)
  }
}

async function generateWithGemini(prompt: string, makeName: string, modelName: string, year: number) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY is not set; skipping Gemini image generation')
    return null
  }

  try {
    console.log(`🎨 Generating AI image with Gemini 3 Pro Image for ${year} ${makeName} ${modelName}`)
    
    // Use Gemini 3 Pro Image (Nano Banana Pro) - state of the art image generation
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    
    const geminiModel = genAI.getGenerativeModel({ 
      model: 'gemini-3-pro-image-preview',
      generationConfig: {
        temperature: 1,
        topP: 0.95,
        topK: 40,
      }
    })

    // Gemini 3 Pro Image generates high-quality images
    const result = await geminiModel.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: `Generate a photorealistic image: ${prompt}` }]
      }],
      generationConfig: {
        // @ts-ignore - responseModalities is a new feature not in types yet
        responseModalities: ['image', 'text'],
      } as any
    })

    const response = result.response
    const parts = response.candidates?.[0]?.content?.parts || []
    
    // Find the image part in the response
    let b64Data: string | null = null
    for (const part of parts) {
      if ('inlineData' in part && part.inlineData?.mimeType?.startsWith('image/')) {
        b64Data = part.inlineData.data
        break
      }
    }

    if (!b64Data) {
      console.error('❌ Gemini image generation returned no image data')
      console.log('Response parts:', JSON.stringify(parts, null, 2))
      return null
    }

    const buffer = Buffer.from(b64Data, 'base64')
    console.log('📦 Gemini image received, size:', buffer.length, 'bytes')

    if (!fs.existsSync(uploadDir)) {
      console.log('📁 Creating upload directory:', uploadDir)
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    const filename = `vehicle-gemini-${Date.now()}-${Math.round(Math.random() * 1e9)}.png`
    const filepath = path.join(uploadDir, filename)
    fs.writeFileSync(filepath, buffer)
    console.log('✅ Gemini image saved to:', filepath)

    return `/uploads/vehicles/${filename}`
  } catch (error) {
    console.error('❌ Failed to generate Gemini image:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
    }
    return null
  }
}

async function generateWithOpenAI(prompt: string) {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️ OPENAI_API_KEY is not set; skipping OpenAI image generation')
    return null
  }

  try {
    console.log('🎨 Generating AI image with OpenAI DALL-E 3')
    
    // Lazy-load to avoid require() ESM issues under commonjs build
    const { default: OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    
    // Use b64_json to get image data directly (avoids DNS/network issues with Azure blob storage)
    const response = await client.images.generate({
      model: 'dall-e-3',
      prompt,
      size: '1792x1024', // Landscape 16:9 ratio - better for cars (horizontal vehicles)
      quality: 'hd',
      n: 1,
      style: 'natural', // More photorealistic than 'vivid'
      response_format: 'b64_json',
    })

    const b64Data = response.data?.[0]?.b64_json
    if (!b64Data) {
      console.error('❌ OpenAI image generation returned no data')
      return null
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(b64Data, 'base64')
    console.log('📦 OpenAI image received, size:', buffer.length, 'bytes')

    if (!fs.existsSync(uploadDir)) {
      console.log('📁 Creating upload directory:', uploadDir)
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    const filename = `vehicle-openai-${Date.now()}-${Math.round(Math.random() * 1e9)}.png`
    const filepath = path.join(uploadDir, filename)
    fs.writeFileSync(filepath, buffer)
    console.log('✅ OpenAI image saved to:', filepath)

    return `/uploads/vehicles/${filename}`
  } catch (error) {
    console.error('❌ Failed to generate OpenAI image:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
    }
    return null
  }
}
