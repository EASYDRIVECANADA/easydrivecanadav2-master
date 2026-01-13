import { Router } from 'express'
import multer from 'multer'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only image files are allowed'))
  },
})

type LicenseScanResult = {
  fullName: string
  address: string
  licenseNumber: string
}

const tryParseJsonObject = (raw: string): any | null => {
  const trimmed = raw.trim()

  // Direct JSON
  try {
    return JSON.parse(trimmed)
  } catch {
    // continue
  }

  // JSON inside a code block
  const blockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (blockMatch?.[1]) {
    try {
      return JSON.parse(blockMatch[1].trim())
    } catch {
      // continue
    }
  }

  // Fallback: first {...} object
  const objMatch = trimmed.match(/\{[\s\S]*\}/)
  if (objMatch?.[0]) {
    try {
      return JSON.parse(objMatch[0])
    } catch {
      // continue
    }
  }

  return null
}

router.post('/scan-license', upload.single('license'), async (req, res, next) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'Missing OPENAI_API_KEY on server. Add it to server/.env then restart the server.',
      })
    }

    const file = req.file
    if (!file) {
      return res.status(400).json({ error: 'No license image provided' })
    }

    const base64 = file.buffer.toString('base64')
    const dataUrl = `data:${file.mimetype};base64,${base64}`

    const { default: OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const prompt = `Extract the following fields from the driver's license image and return STRICT JSON only (no markdown, no extra text):\n\n{\n  "fullName": string,\n  "address": string,\n  "licenseNumber": string\n}\n\nRules:\n- If a field is missing/unclear, return an empty string for that field.\n- Do not include any other keys.`

    const response = await client.responses.create({
      model: 'gpt-4o-mini',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: dataUrl },
          ],
        },
      ],
      temperature: 0,
    } as any)

    const text = (response as any).output_text as string | undefined
    if (!text) {
      return res.status(500).json({ error: 'OCR returned no content' })
    }

    const parsed = tryParseJsonObject(text)
    if (!parsed || typeof parsed !== 'object') {
      return res.status(500).json({ error: 'Failed to parse OCR response', raw: text })
    }

    const result: LicenseScanResult = {
      fullName: typeof parsed.fullName === 'string' ? parsed.fullName : '',
      address: typeof parsed.address === 'string' ? parsed.address : '',
      licenseNumber: typeof parsed.licenseNumber === 'string' ? parsed.licenseNumber : '',
    }

    return res.json(result)
  } catch (err) {
    return next(err)
  }
})

export default router
