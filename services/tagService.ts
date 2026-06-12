import { TagCategory } from '../types';

interface TagData {
    tagId: number;
    name: string;
    category: number;
    count: number;
}

let tagDatabase: Map<string, TagCategory> = new Map();
let loadPromise: Promise<void> | null = null;

const CATEGORY_MAPPING: Record<number, TagCategory> = {
    0: 'general',
    1: 'artist',
    3: 'copyright',
    4: 'character',
    5: 'meta',
    9: 'rating'
};

const doLoadTagDatabase = async (): Promise<void> => {
    const response = await fetch('/danbooru_tags.csv');
    if (!response.ok) {
        throw new Error(`Failed to load tag database: ${response.statusText}`);
    }

    const text = await response.text();
    const lines = text.split('\n');

    // No header in tags.csv; format: name,category[,count,aliases].
    // Only the first two fields are used, so slice them out by comma index
    // instead of split(',') to avoid materializing the unused columns.
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const c1 = line.indexOf(',');
        if (c1 <= 0) continue;

        const name = line.slice(0, c1);
        const c2 = line.indexOf(',', c1 + 1);
        const categoryId = parseInt(line.slice(c1 + 1, c2 === -1 ? line.length : c2), 10);
        if (Number.isNaN(categoryId)) continue;

        tagDatabase.set(name, CATEGORY_MAPPING[categoryId] || 'general');
    }

    console.log(`[TagService] Loaded ${tagDatabase.size} tags.`);
};

export const loadTagDatabase = (): Promise<void> => {
    if (!loadPromise) {
        loadPromise = doLoadTagDatabase().catch((error) => {
            console.error("[TagService] Error loading tag database:", error);
            loadPromise = null; // allow a retry on the next call
        });
    }
    return loadPromise;
};

// Fallback heuristics for tags not in CSV (or if CSV failed to load)
const RATING_TAGS = new Set(['general', 'safe', 'questionable', 'explicit', 'sensitive', 'nsfw']);
const META_TAGS = new Set(['highres', 'absurdres', '4k', '8k', 'masterpiece', 'best quality', 'comic', 'monochrome', 'greyscale', 'lowres', 'bad quality', 'worst quality']);

export const getCategory = (tagName: string): TagCategory => {
    // 1. Try exact match from CSV
    const fromDb = tagDatabase.get(tagName);
    if (fromDb) return fromDb;

    // 2. Fallback heuristics
    if (tagName.startsWith('rating:') || RATING_TAGS.has(tagName)) {
        return 'rating';
    }
    if (META_TAGS.has(tagName)) {
        return 'meta';
    }

    return 'general';
};

export const isTagInCategory = (tagName: string, category: TagCategory): boolean => {
    return tagDatabase.get(tagName) === category;
};

export const isValidTag = (tagName: string): boolean => {
    return tagDatabase.has(tagName);
};
