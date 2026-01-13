declare module 'tesseract.js' {
  export type RecognizeResult = {
    data?: {
      text?: string
    }
  }

  export function recognize(image: any, lang?: string): Promise<RecognizeResult>
}
