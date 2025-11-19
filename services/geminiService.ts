
import { GoogleGenAI, Type } from "@google/genai";
import { Tag, BackendConfig, TagCategory, InterrogationResult } from "../types";

// --- GEMINI IMPLEMENTATION ---
const getGeminiClient = (apiKey: string) => {
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please enter it in the configuration panel.");
  }
  return new GoogleGenAI({ apiKey });
};

const generateTagsGemini = async (base64Image: string, mimeType: string, config: BackendConfig): Promise<InterrogationResult> => {
  const ai = getGeminiClient(config.geminiApiKey);

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      tags: {
        type: Type.ARRAY,
        description: "A list of strict Danbooru-wiki tags describing the image.",
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            score: { type: Type.NUMBER },
            category: {
              type: Type.STRING,
              enum: ['general', 'character', 'copyright', 'artist', 'meta', 'rating']
            }
          },
          required: ["name", "score", "category"],
        },
      },
    },
    required: ["tags"],
  };

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: mimeType, data: base64Image } },
        { text: getInterrogationPrompt() },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      systemInstruction: "You are an expert Danbooru tagger.",
    },
  });

  if (!response.text) return { tags: [] };
  try {
    const data = JSON.parse(response.text);
    // Gemini generates tags first, caption is separate
    return { tags: data.tags || [] };
  } catch (e) {
    console.error("JSON Parse error in Gemini response", e);
    return { tags: [] };
  }
};

// --- LOCAL HYBRID IMPLEMENTATION ---
// Orchestrates: Local Tagger -> Ollama (Clean/Categorize + Caption)
// --- LOCAL HYBRID IMPLEMENTATION ---

// --- HELPER FUNCTIONS ---

const getProxiedOllamaEndpoint = (originalEndpoint: string): string => {
  // Always remove trailing slash to prevent double slashes (e.g. //api/tags)
  let cleanEndpoint = originalEndpoint;
  if (cleanEndpoint.endsWith('/')) {
    cleanEndpoint = cleanEndpoint.slice(0, -1);
  }

  // Only apply proxy rewriting in Development mode
  if (import.meta.env.DEV && cleanEndpoint.includes('ollama.gpu.garden')) {
    // Remove protocol and domain
    let path = cleanEndpoint.replace(/^https?:\/\//, '').replace(/^ollama\.gpu\.garden/, '');
    
    // Ensure path starts with / if it's not empty
    if (!path) {
      path = ''; 
    } else if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    const newEndpoint = `/ollama/gpu-garden${path}`;
    console.log(`[Proxy] Rewrote Ollama ${originalEndpoint} to ${newEndpoint}`);
    return newEndpoint;
  }
  
  return cleanEndpoint;
};

const determineCategory = (name: string): TagCategory => {
  // Strict Rating Categorization
  if (name.startsWith('rating:') || ['general', 'safe', 'questionable', 'explicit', 'sensitive', 'nsfw'].includes(name)) {
    return 'rating';
  }
  // Meta / Technical Tags
  if (['highres', 'absurdres', '4k', '8k', 'masterpiece', 'best quality', 'comic', 'monochrome', 'greyscale', 'lowres', 'bad quality', 'worst quality'].includes(name)) {
    return 'meta';
  }
  // Character Counts (Danbooru puts these in General, but users often see them as character-related. Keeping as General per strict Danbooru)
  if (['1girl', '1boy', '2girls', '2boys', 'multiple girls', 'multiple boys'].includes(name)) {
    return 'general'; 
  }
  
  return 'general';
};

export const fetchLocalTags = async (base64Image: string, config: BackendConfig): Promise<Tag[]> => {
  if (!config.taggerEndpoint || config.taggerEndpoint.trim() === '') {
    throw new Error("Local Tagger endpoint is invalid or missing.");
  }

  // Convert base64 to blob for FormData
  const byteCharacters = atob(base64Image);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/png' }); // Type doesn't strictly matter for the backend usually, but good practice

  const formData = new FormData();
  formData.append('file', blob, 'image.png');

  // Automatic Proxy Handling for known CORS-restricted endpoints (DEV ONLY)
  let endpoint = config.taggerEndpoint;
  if (import.meta.env.DEV && endpoint.includes('localtagger.gpu.garden')) {
    // Remove protocol and domain to get the relative path
    let path = endpoint.replace(/^https?:\/\//, '').replace(/^localtagger\.gpu\.garden/, '');
    
    // If path is empty or just '/', default to '/interrogate/pixai'
    if (!path || path === '/') {
      path = '/interrogate/pixai';
    } else if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Construct the proxy endpoint
    endpoint = `/interrogate/gpu-garden${path}`;
    console.log(`[Proxy] Rewrote ${config.taggerEndpoint} to ${endpoint}`);
  }

  try {
    // User verified curl command: curl -X POST -F "file=@..." http://localhost:8000/interrogate/pixai
    // We stick to this exactly, removing hardcoded threshold and model params that might cause issues.
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Local Tagger Error: ${response.statusText}`);
    }

    const data = await response.json();
    // Expected format: { tags: { "1girl": 0.99, ... }, tag_string: "..." }
    // OR Array format: { tags: [["1girl", 0.99], ...] } or { tags: [{name: "1girl", score: 0.99}, ...] }

    const tags: Tag[] = [];
    
    if (data.tags) {
      if (Array.isArray(data.tags)) {
        // Handle Array format
        data.tags.forEach((item: any) => {
          let name = '';
          let score = 0;
          
          if (Array.isArray(item)) {
            name = item[0];
            score = Number(item[1]);
          } else if (typeof item === 'object') {
            name = item.name || item.tag;
            score = Number(item.score || item.confidence || item.probability);
          }

          if (name) {
            tags.push({
              name,
              score,
              category: determineCategory(name)
            });
          }
        });
      } else if (typeof data.tags === 'object') {
        // Handle Object format
        Object.entries(data.tags).forEach(([name, score]) => {
          tags.push({
            name,
            score: Number(score),
            category: determineCategory(name)
          });
        });
      }
    }

    // Filter out known hallucinations
    const filteredTags = tags.filter(tag => {
      // Filter blue_skin / colored_skin if confidence is low (likely a false positive from lighting)
      if (['blue_skin', 'colored_skin'].includes(tag.name) && tag.score < 0.85) {
        return false;
      }
      return true;
    });

    // Sort by score descending
    return filteredTags.sort((a, b) => b.score - a.score);
  } catch (error: any) {
    console.error("Fetch Local Tags Error:", error);
    
    // Enhance error message for common CORS issues with remote URLs
    if (config.taggerEndpoint.startsWith('http') && !config.taggerEndpoint.includes('localhost') && error.message === 'Failed to fetch') {
      throw new Error(`Network Error (CORS): The browser blocked the request to ${config.taggerEndpoint}. This is a security feature. To fix this, update vite.config.ts to proxy this URL, or ensure the server allows CORS.`);
    }
    
    throw error;
  }
};

export const fetchOllamaModels = async (endpoint: string): Promise<string[]> => {
  if (!endpoint || endpoint.trim() === '') {
    return [];
  }

  const proxiedEndpoint = getProxiedOllamaEndpoint(endpoint);

  try {
    const response = await fetch(`${proxiedEndpoint}/api/tags`);
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    const data = await response.json();
    // Ollama returns { models: [{ name: "qwen:vl", ... }] }
    return data.models?.map((m: any) => m.name) || [];
  } catch (error) {
    console.error("Fetch Ollama Models Error:", error);
    return [];
  }
};

export const fetchOllamaDescription = async (base64Image: string, config: BackendConfig): Promise<string> => {
  if (!config.ollamaEndpoint || config.ollamaEndpoint.trim() === '') {
    throw new Error("Ollama endpoint is invalid or missing.");
  }

  const proxiedEndpoint = getProxiedOllamaEndpoint(config.ollamaEndpoint);

  try {
    const response = await fetch(`${proxiedEndpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt: "Describe this image in detail. Then, list 5 key themes.",
        images: [base64Image],
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("Fetch Ollama Description Error:", error);
    throw error;
  }
};

const consolidateTagsWithOllama = async (
  localTags: Tag[],
  ollamaDescription: string,
  config: BackendConfig
): Promise<Tag[]> => {
  if (!config.ollamaEndpoint) return localTags;

  const localTagsString = localTags.map(t => `${t.name} (${t.score.toFixed(2)})`).join(', ');
  
  const prompt = `
    You are an expert Danbooru tagger. Your task is to consolidate tags from a local tagger and a natural language description into a final, strict JSON list of Danbooru tags.
    
    INPUTS:
    1. Local Tagger Output (High Trust): ${localTagsString}
    2. Visual Description (Context): ${ollamaDescription}

    INSTRUCTIONS:
    - TRUST the Local Tagger tags the most.
    - Use the Description to add missing tags or clarify context, but ONLY if they are valid Danbooru tags.
    - Ensure "technical" tags (e.g., 'highres', 'absurdres', '4k') are included if implied.
    - Categorize every tag correctly: 'general', 'character', 'style', 'technical', 'rating'.
    - Output STRICT JSON format ONLY. No markdown, no explanations.

    JSON SCHEMA:
    {
      "tags": [
        { "name": "tag_name", "score": 1.0, "category": "category_name" }
      ]
    }
  `;

  try {
    const response = await fetch(`${config.ollamaEndpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt: prompt,
        format: "json",
        stream: false
      })
    });

    const data = await response.json();
    const parsed = JSON.parse(data.response);
    return parsed.tags || localTags;
  } catch (error) {
    console.error("Consolidation Error:", error);
    return localTags; // Fallback to local tags
  }
};

const refineDescriptionWithOllama = async (
  finalTags: Tag[],
  config: BackendConfig
): Promise<string> => {
  if (!config.ollamaEndpoint) return "";

  const tagsString = finalTags.map(t => t.name).join(', ');
  
  const prompt = `
    Generate a detailed natural language description of an image based STRICTLY on these Danbooru tags.
    
    TAGS: ${tagsString}
    
    INSTRUCTIONS:
    - Describe the image naturally.
    - Do not list the tags.
    - Focus on the visual elements described by the tags.
    - Ensure parity with the tags provided.
  `;

  try {
    const response = await fetch(`${config.ollamaEndpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt: prompt,
        stream: false
      })
    });

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("Refine Description Error:", error);
    return "";
  }
};

const generateTagsLocalHybrid = async (base64Image: string, config: BackendConfig): Promise<InterrogationResult> => {
  // 1. Run Local Tagger ONLY (as per user request for raw output first)
  const localTags = await fetchLocalTags(base64Image, config);

  // 2. Return tags immediately. Description is generated on demand.
  return {
    tags: localTags,
    naturalDescription: undefined
  };
};

// --- SHARED UTILITIES ---

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

function getInterrogationPrompt() {
  return `
    Analyze this image for Stable Diffusion tagging using strict Danbooru standards.
    
    CRITICAL RULES:
    1. **REAL TAGS ONLY**: Use ONLY tags that exist in the Danbooru/Gelbooru wiki. 
    2. **Format**: Lowercase, underscores for spaces.
    3. **Categorize**: 'general', 'character', 'copyright', 'artist', 'meta', 'rating'.
    
    DEEP CHARACTER SCAN:
    - Hair: Color, Length, Style.
    - Eyes: Color, Shape, Pupils.
    - Features: ears, horns, wings.
    - Body: clothing, legwear, pose.

    MANDATORY TAGS:
    - **Rating**: One of ['rating:general', 'rating:safe', 'rating:sensitive', 'rating:questionable', 'rating:explicit'].
    - **Count**: 1girl, 1boy, etc.
  `;
}

// --- MAIN EXPORTED FUNCTIONS ---

export const generateTags = async (
  base64Image: string,
  mimeType: string,
  config: BackendConfig
): Promise<InterrogationResult> => {
  switch (config.type) {
    case 'local_hybrid':
      return generateTagsLocalHybrid(base64Image, config);
    case 'gemini':
    default:
      return generateTagsGemini(base64Image, mimeType, config);
  }
};

export const generateCaption = async (
  base64Image: string,
  mimeType: string,
  config: BackendConfig,
  existingTags?: Tag[]
): Promise<string> => {

  if (config.type === 'local_hybrid') {
    if (!config.ollamaEndpoint || config.ollamaEndpoint.trim() === '') {
      throw new Error("Ollama endpoint is missing.");
    }
    
    const proxiedEndpoint = getProxiedOllamaEndpoint(config.ollamaEndpoint);

    let prompt = "Describe this image in detail for an image generation prompt.";
    if (existingTags && existingTags.length > 0) {
       const tagList = existingTags.map(t => t.name.replace(/_/g, ' ')).join(', ');
       prompt = `You are a visual analysis AI. 
       
       I have analyzed this image with a tagger and found these features: ${tagList}.
       
       Using your vision capabilities, verify these features in the image and write a detailed, natural language description.
       - Incorporate the provided tags into a cohesive narrative.
       - If a tag seems visually wrong based on your view of the image, ignore it.
       - Focus on composition, colors, lighting, and mood.
       - Do not just list the tags; write in full sentences.
       - IMPORTANT: Output ONLY the description. Do not include any thinking process, reasoning, or meta-commentary.
       `;
    }

    const response = await fetch(`${proxiedEndpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt: prompt,
        images: [base64Image],
        stream: false
      })
    });
    const data = await response.json();
    
    // Clean up potential "thinking" artifacts if the model ignores the instruction
    let cleanResponse = data.response;
    
    // Remove <think> blocks often produced by reasoning models
    cleanResponse = cleanResponse.replace(/<think>[\s\S]*?<\/think>/gi, '');
    
    // Remove common meta-commentary prefixes
    cleanResponse = cleanResponse.replace(/^(Here is a description|Sure, here is|Based on the tags|The image shows|I can see that).{0,20}:\s*/i, '');
    
    return cleanResponse.trim();
  }

  // Gemini Implementation
  const ai = getGeminiClient(config.geminiApiKey);
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { inlineData: { mimeType: mimeType, data: base64Image } },
        { text: "Generate a detailed, natural language description of this image suitable for use as a prompt for an image generation model (like Stable Diffusion)." },
      ],
    },
  });
  return response.text || "";
};
