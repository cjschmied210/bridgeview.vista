import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set in environment variables");
}

const genAI = new GoogleGenerativeAI(apiKey || "mock-key");

// Using gemini-2.0-flash as the detected available model
export const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
