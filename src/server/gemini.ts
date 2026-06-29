import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error(
        'GEMINI_API_KEY environment variable is required. Vercel\'de Project Settings > Environment Variables bölümünden ekleyin.'
      );
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}
