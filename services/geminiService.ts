
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

  // In Production, use Cloudflare Pages Function proxy to bypass CORS/WAF
  if (import.meta.env.PROD && cleanEndpoint.includes('ollama.gpu.garden')) {
    console.log(`[Proxy] Rewriting Ollama ${originalEndpoint} to Cloudflare Function /ollama`);
    return '/ollama';
  }

  return cleanEndpoint;
};

import { getCategory, loadTagDatabase, isTagInCategory } from './tagService';

// Ensure database is loaded when service is imported/used
// We can't await at top level easily in all envs, so we'll call it lazily or just kick it off.
loadTagDatabase();


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

  // Ensure path exists for gpu.garden endpoint
  if (endpoint.includes('localtagger.gpu.garden') && !endpoint.includes('/interrogate')) {
    endpoint = endpoint.replace(/\/$/, '') + '/interrogate';
  }

  // Force HTTPS for remote endpoints to prevent Mixed Content errors
  if (endpoint.includes('gpu.garden') && endpoint.startsWith('http:')) {
    endpoint = endpoint.replace('http:', 'https:');
  }

  // Automatic Proxy Handling:
  // 1. DEV mode
  // 2. PROD mode BUT running locally (e.g., vite preview)
  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if ((import.meta.env.DEV || isLocalhost) && endpoint.includes('localtagger.gpu.garden')) {
    // Remove protocol and domain to get the relative path
    let path = endpoint.replace(/^https?:\/\//, '').replace(/^localtagger\.gpu\.garden/, '');

    // If path is empty or just '/', default to '/interrogate'
    if (!path || path === '/') {
      path = '/interrogate';
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
      throw new Error(`Local Tagger Error: ${response.status} ${response.statusText}`);
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
              category: getCategory(name)
            });
          }
        });
      } else if (typeof data.tags === 'object') {
        // Handle Object format
        Object.entries(data.tags).forEach(([name, score]) => {
          tags.push({
            name,
            score: Number(score),
            category: getCategory(name)
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
      throw new Error(`Failed to fetch models: ${response.statusText} (${response.status})`);
    }
    const data = await response.json();
    
    // Filter for Vision Models only
    // Based on known vision model families and keywords
    const visionKeywords = [
      'vl', 'vision', 'llava', 'moondream', 'minicpm-v', 'gemma3', 
      'llama3.2-vision', 'llama4', 'mistral-small', 'granite3.2-vision', 'bakllava'
    ];

    const models = data.models || [];
    const visionModels = models.filter((m: any) => {
      const name = m.name.toLowerCase();
      // Check name against keywords
      const isVisionName = visionKeywords.some(k => name.includes(k));
      
      // Check details if available (some models might declare family)
      const family = m.details?.family?.toLowerCase() || '';
      const isVisionFamily = family.includes('llava') || family.includes('clip');

      return isVisionName || isVisionFamily;
    });

    return visionModels.map((m: any) => m.name);
  } catch (error: any) {
    console.error("Fetch Ollama Models Error:", error);

    // Detect CORS/Network errors
    if (error.name === 'TypeError' && (error.message === 'Failed to fetch' || error.message.includes('NetworkError'))) {
      console.warn(`
       [CORS ERROR DETECTED]
       The browser blocked the request to ${proxiedEndpoint}.
       
       SOLUTION:
       If you are running Ollama, you must set the OLLAMA_ORIGINS environment variable to allow this domain.
       Example: OLLAMA_ORIGINS="https://tagger.gpu.garden" ollama serve
       `);
    }
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
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
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

// --- HYBRID MERGING LOGIC ---

interface TagState {
  localTags: Tag[];
  ollamaTags: Tag[];
  combinedTags: Tag[];
  summary: string | undefined;
}

const normalizeTag = (tag: string): string => {
  // Ensure tags match Danbooru format (lowercase, underscores) for CSV lookup
  return tag.toLowerCase().trim().replace(/ /g, '_');
};

const mergeTags = (localTags: Tag[], ollamaTags: Tag[]): Tag[] => {
  const combined = new Map<string, Tag>();

  // 1. Add Local Tags (Primary Source - High Confidence)
  localTags.forEach(tag => {
    const normalized = normalizeTag(tag.name);
    combined.set(normalized, { ...tag, source: 'local' });
  });

  // 2. Add Ollama Tags (Secondary Source)
  // Logic Update: If we have Local Tags (Ground Truth), ONLY use Ollama tags for parity (marking as 'both').
  // Do NOT add unique Ollama tags as they are often hallucinations or abstract concepts user wants to avoid in Technical Tags.
  // If Local Tags are empty (failure/fallback), then use all Ollama tags.
  const hasLocalTags = localTags.length > 0;

  ollamaTags.forEach(tag => {
    const normalized = normalizeTag(tag.name);
    if (combined.has(normalized)) {
      // Parity Check: If both have it, boost confidence or keep local's high confidence
      const existing = combined.get(normalized)!;
      combined.set(normalized, {
        ...existing,
        score: Math.max(existing.score, tag.score),
        source: 'both' // Mark as found in both
      });
    } else if (!hasLocalTags) {
      // Only add new tag from Ollama if we DON'T have local tags (Fallback mode)
      combined.set(normalized, { ...tag, source: 'ollama' });
    }
  });

  return Array.from(combined.values()).sort((a, b) => b.score - a.score);
};

const fetchOllamaTagsAndSummary = async (
  base64Image: string,
  config: BackendConfig,
  existingTags: Tag[] = []
): Promise<{ tags: Tag[], summary: string }> => {
  if (!config.ollamaEndpoint) return { tags: [], summary: "" };

  const proxiedEndpoint = getProxiedOllamaEndpoint(config.ollamaEndpoint);

  let prompt = "Describe this image using a comma-separated list of Danbooru-style tags (lowercase, underscores for spaces) and a short summary. Format: Tags: tag1, tag2, ... Summary: ...";

  if (existingTags.length > 0) {
    // Pass tags with confidence scores as requested
    const tagList = existingTags.map(t => `${t.name} (${t.score.toFixed(2)})`).join(', ');
    prompt = `Analyze this image. I have already detected these tags with confidence scores: ${tagList}.
    
    1. Verify these tags visually.
    2. Add any missing tags that are visually apparent.
    3. Write a detailed natural language description (summary) of the image.
       - Use the provided tags as a guide for what is present, but convert them into natural, flowing sentences.
       - Do NOT simply list the tags or use technical terms like "1girl", "solo", or "looking_at_viewer" directly unless they fit naturally (e.g. "a solo girl looking at the viewer").
       - Focus on the character's appearance, clothing, pose, and the background.
       - Ensure character names and series titles are mentioned naturally.
    
    Format your response exactly as:
    Tags: tag1, tag2, ...
    Summary: [Your detailed description here]
    `;
  }

  try {
    const response = await fetch(`${proxiedEndpoint}/api/generate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt: prompt,
        images: [base64Image],
        stream: false
      })
    });

    const data = await response.json();
    const text = data.response;

    // Parse Tags and Summary
    const tagsMatch = text.match(/Tags:\s*(.*?)(?:\n|$|Summary:)/i);
    const summaryMatch = text.match(/Summary:\s*(.*)/i);

    const rawTags = tagsMatch ? tagsMatch[1].split(',').map((t: string) => t.trim()) : [];
    const summary = summaryMatch ? summaryMatch[1].trim() : text; // Fallback to full text if no format

    const tags: Tag[] = rawTags.map((name: string) => ({
      name: name,
      score: 0.7, // Default confidence for Ollama tags
      category: getCategory(name),
      source: 'ollama'
    }));

    return { tags, summary };
  } catch (error) {
    console.error("Ollama Tagging Error:", error);
    return { tags: [], summary: "" };
  }
};

const fetchOllamaCopyrights = async (
  characters: string[],
  config: BackendConfig
): Promise<Tag[]> => {
  if (!config.ollamaEndpoint || characters.length === 0) return [];

  const proxiedEndpoint = getProxiedOllamaEndpoint(config.ollamaEndpoint);
  const charList = characters.join(', ');

  // Prompt engineering: Ask for specific Danbooru copyright tags
  const prompt = `Identify the series/copyright for these characters: ${charList}. 
  Return ONLY a JSON array of strings containing the strict Danbooru copyright tags. 
  Example: ["touhou", "fate/grand_order"]. 
  If unknown, ignore.`;

  try {
    const response = await fetch(`${proxiedEndpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt: prompt,
        format: "json", // Force JSON mode if supported by model, otherwise prompt handles it
        stream: false
      })
    });

    const data = await response.json();
    let copyrights: string[] = [];

    if (!data.response || data.response.trim() === '') {
      console.warn("Ollama returned empty response for copyrights.");
      return [];
    }

    try {
      // Try parsing JSON directly if model obeyed
      // Some models might return text with JSON block, so we might need to extract
      const jsonMatch = data.response.match(/\[.*\]/s);
      if (jsonMatch) {
        copyrights = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: try parsing the whole response
        copyrights = JSON.parse(data.response);
      }
    } catch (e) {
      console.warn("Failed to parse Ollama copyright response:", data.response);
      return [];
    }

    // Validate and map to Tags
    const validTags: Tag[] = [];
    for (const name of copyrights) {
      const normalized = normalizeTag(name);
      // Verify it's actually a copyright tag in our DB
      if (isTagInCategory(normalized, 'copyright')) {
        validTags.push({
          name: normalized,
          score: 0.8, // High confidence since it's a specific lookup
          category: 'copyright',
          source: 'ollama'
        });
      }
    }
    return validTags;

  } catch (error) {
    console.error("Ollama Copyright Lookup Error:", error);
    return [];
  }
};

const enrichTagsWithCopyrights = async (
  currentTags: Tag[],
  config: BackendConfig
): Promise<Tag[]> => {
  const newTags = [...currentTags];
  const existingNames = new Set(newTags.map(t => t.name));
  const charactersNeedingLookup: string[] = [];

  // 1. Regex Extraction
  for (const tag of currentTags) {
    // Check ALL tags for parenthetical series info, not just characters
    // e.g. excalibur_(fate/stay_night) might be 'general' or 'item'
    const match = tag.name.match(/.*\((.*?)\)/);
    if (match) {
      const seriesName = normalizeTag(match[1]);
      // Check if this series name is a valid copyright tag
      if (isTagInCategory(seriesName, 'copyright') && !existingNames.has(seriesName)) {
        newTags.push({
          name: seriesName,
          score: tag.score, // Inherit score
          category: 'copyright',
          source: tag.source
        });
        existingNames.add(seriesName);
      } else if (!existingNames.has(seriesName)) {
        // If regex found something but it's not a known tag (e.g. 'fate'), 
        // add the ORIGINAL tag to lookup list so Ollama can resolve it.
        // e.g. 'artoria_pendragon_(fate)' -> Ollama knows this is Fate/Grand Order
        charactersNeedingLookup.push(tag.name);
      }
    } else if (tag.category === 'character') {
      // No parenthesis, but it's a character, so look it up
      charactersNeedingLookup.push(tag.name);
    }
  }

  // 2. Ollama Fallback
  if (charactersNeedingLookup.length > 0 && config.ollamaEndpoint) {
    console.log(`[Copyright Lookup] Querying Ollama for characters: ${charactersNeedingLookup.join(', ')}`);
    const ollamaCopyrights = await fetchOllamaCopyrights(charactersNeedingLookup, config);
    console.log(`[Copyright Lookup] Found copyrights: ${ollamaCopyrights.map(t => t.name).join(', ')}`);
    
    for (const tag of ollamaCopyrights) {
      if (!existingNames.has(tag.name)) {
        newTags.push(tag);
        existingNames.add(tag.name);
      }
    }
  }

  return newTags.sort((a, b) => b.score - a.score);
};

const generateTagsLocalHybrid = async (base64Image: string, config: BackendConfig): Promise<InterrogationResult> => {
  // Sequential Fetching to feed Local Tags into Ollama
  let localTags: Tag[] = [];
  try {
    localTags = await fetchLocalTags(base64Image, config);
  } catch (e) {
    console.error("Local Tagger Failed:", e);
  }

  // Enrich Local Tags with Copyrights BEFORE sending to Ollama
  // This ensures Ollama knows the series context (e.g. Fate) when generating the description
  try {
    localTags = await enrichTagsWithCopyrights(localTags, config);
  } catch (e) {
    console.error("Copyright Enrichment Failed:", e);
  }

  let ollamaData: { tags: Tag[], summary: string | undefined } = { tags: [], summary: undefined };
  try {
    // Pass enriched local tags to Ollama for better context
    ollamaData = await fetchOllamaTagsAndSummary(base64Image, config, localTags);
  } catch (e) {
    console.error("Ollama Failed:", e);
  }

  // Merging Strategy
  let combinedTags = mergeTags(localTags, ollamaData.tags);
  
  return {
    tags: combinedTags,
    naturalDescription: ollamaData.summary
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
  // Ensure tag database is loaded before processing
  await loadTagDatabase();

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
