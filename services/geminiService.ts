import { GoogleGenAI } from "@google/genai";
import { SearchResult } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please ensure process.env.API_KEY is available.");
  }
  return new GoogleGenAI({ apiKey });
};

export const searchForImages = async (query: string): Promise<SearchResult[]> => {
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Find 5 distinct and high-quality image URLs corresponding to: "${query}". 
      Context: The user needs to annotate 'cars on bridges' for a dataset.
      
      Requirements:
      1. Images must clearly show at least one car on a bridge.
      2. Prefer direct image links (ending in .jpg, .png) or high-quality stock photo pages (Unsplash, Pexels, etc.).
      3. Avoid generic clip art or cartoons.
      4. Return strictly valid URLs that are likely to be embeddable.
      
      Output strictly the links found via the googleSearch tool.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (chunks) {
      // De-duplicate URLs
      const uniqueUrls = new Set();
      const results: SearchResult[] = [];

      for (const chunk of chunks) {
          if (chunk.web?.uri && !uniqueUrls.has(chunk.web.uri)) {
              uniqueUrls.add(chunk.web.uri);
              results.push({
                  title: chunk.web.title || "Image Source",
                  url: chunk.web.uri,
                  snippet: "Found via Google Search"
              });
          }
      }
      return results.slice(0, 10); // Return up to 10 suggestions
    }
    
    return [];
  } catch (error) {
    console.error("Gemini Search Error:", error);
    return [];
  }
};

export const suggestAnnotations = async (base64Image: string, mimeType: string): Promise<string> => {
   try {
    const ai = getClient();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
            parts: [
                { inlineData: { data: base64Image, mimeType: mimeType } },
                { text: "Analyze this image for vehicle annotation. Identify the main car in the image. Return a JSON object with: 'name' (specific model or generic description, e.g. 'Red Sedan'), 'type' (e.g. Sedan, SUV, Truck, Coupe, Convertible, Van, Hatchback, Wagon, Sports Car, Pickup, Bus, Motorcycle), and 'quality' (Low, Medium, High) based on image clarity. JSON: { \"name\": string, \"type\": string, \"quality\": string }" }
            ]
        },
        config: {
            responseMimeType: "application/json"
        }
    });
    return response.text;
   } catch (error) {
       console.error("Gemini Analyze Error:", error);
       throw error;
   }
}