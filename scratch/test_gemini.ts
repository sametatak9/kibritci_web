import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function testGemini() {
  const key = process.env.GEMINI_API_KEY;
  console.log("Using API Key:", key ? `${key.substring(0, 8)}...` : "NOT FOUND");
  
  if (!key) {
    console.error("No GEMINI_API_KEY found in environment!");
    return;
  }

  const ai = new GoogleGenAI({ apiKey: key });

  try {
    console.log("Testing with gemini-2.5-flash...");
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Hello, this is a test. Please reply with 'OK' if you can read this.",
    });
    console.log("Response:", response.text);
  } catch (error: any) {
    console.error("Error with gemini-2.5-flash:", error);
  }

  try {
    console.log("Testing with gemini-2.0-flash...");
    const response2 = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: "Hello, this is a test. Please reply with 'OK' if you can read this.",
    });
    console.log("Response 2:", response2.text);
  } catch (error: any) {
    console.error("Error with gemini-2.0-flash:", error);
  }

  try {
    console.log("Testing with gemini-1.5-flash...");
    const response3 = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: "Hello, this is a test. Please reply with 'OK' if you can read this.",
    });
    console.log("Response 3:", response3.text);
  } catch (error: any) {
    console.error("Error with gemini-1.5-flash:", error);
  }
}

testGemini();
