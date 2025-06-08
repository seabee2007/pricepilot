/**
 * Smart eBay Category Detection System
 * 
 * This module provides automatic category detection for eBay search queries using the eBay Taxonomy API.
 * It fetches the full category tree, builds keyword mappings, and picks the best category for any query.
 * 
 * Features:
 * - Fetches and caches eBay taxonomy (refreshed daily)
 * - Smart keyword-based category matching
 * - Excludes motors (cars & trucks) category
 * - Proper error handling and retry logic
 * - TypeScript support with comprehensive types
 * 
 * Usage:
 * ```ts
 * import { pickCategory, loadCategories } from './ebayCategories';
 * 
 * const categoryId = pickCategory('iphone 15 pro');  // Returns '9355' (Cell Phones)
 * ```
 */

import { config } from './config';

// ===============================
// TYPES & INTERFACES
// ===============================

export interface CategoryDef {
  categoryId: string;
  categoryName: string;
  categoryPath: string;  // Full path like "Electronics > Cell Phones & Accessories > Cell Phones"
  keywords: string[];
  level: number;  // Depth in the tree
  parentId?: string;
}

export interface TaxonomyNode {
  categoryId: string;
  categoryName: string;
  categoryTreeNodeLevel?: number;
  leafCategoryTreeNode?: boolean;
  parentCategoryTreeNodeId?: string;
  childCategoryTreeNodes?: TaxonomyNode[];
}

export interface TaxonomyResponse {
  categoryTreeId: string;
  categoryTreeVersion: string;
  rootCategoryNode: TaxonomyNode;
}

interface CategoryCache {
  categories: CategoryDef[];
  lastUpdated: number;
  version: string;
}

// ===============================
// CONSTANTS & CONFIGURATION
// ===============================

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const TAXONOMY_API_URL = 'https://api.ebay.com/commerce/taxonomy/v1/category_tree/0'; // EBAY_US
const SANDBOX_TAXONOMY_API_URL = 'https://api.sandbox.ebay.com/commerce/taxonomy/v1/category_tree/0';

// Categories to exclude from automatic detection
const EXCLUDED_CATEGORIES = new Set([
  '6001',  // eBay Motors > Cars & Trucks
  '6028',  // eBay Motors (root)
]);

// Common synonyms and alternative terms for better matching
const KEYWORD_SYNONYMS: Record<string, string[]> = {
  'phone': ['mobile', 'smartphone', 'cell', 'cellular', 'iphone', 'android'],
  'laptop': ['notebook', 'computer', 'pc', 'macbook'],
  'tv': ['television', 'display', 'monitor', 'smart tv'],
  'game': ['gaming', 'video game', 'console', 'playstation', 'xbox', 'nintendo'],
  'book': ['novel', 'textbook', 'ebook', 'paperback', 'hardcover'],
  'clothes': ['clothing', 'apparel', 'fashion', 'shirt', 'pants', 'dress'],
  'jewelry': ['jewellery', 'accessory', 'accessories', 'necklace', 'ring', 'bracelet'],
  'watch': ['timepiece', 'clock', 'smartwatch', 'rolex', 'apple watch'],
  'camera': ['photography', 'photo', 'digital camera', 'dslr', 'canon', 'nikon'],
  'music': ['audio', 'sound', 'speaker', 'headphones', 'earbuds'],
  'home': ['house', 'household', 'domestic', 'furniture', 'decor'],
  'car': ['auto', 'automobile', 'vehicle'],
  'tool': ['equipment', 'hardware', 'drill', 'saw'],
  'sport': ['sports', 'athletic', 'fitness', 'exercise'],
  'toy': ['toys', 'children', 'kids', 'baby'],
  'beauty': ['makeup', 'cosmetics', 'skincare', 'perfume'],
  'shoes': ['footwear', 'sneakers', 'boots', 'sandals'],
  'bag': ['purse', 'backpack', 'handbag', 'wallet'],
  'electronics': ['electronic', 'gadget', 'device', 'tech'],
};

// ===============================
// IN-MEMORY CACHE
// ===============================

let categoryCache: CategoryCache | null = null;
let refreshTimer: NodeJS.Timeout | null = null;

// ===============================
// CATEGORY OVERRIDE MAP
// ===============================

// High-priority direct mappings for common search terms
// First match wins - put highest priority overrides at the top
const CATEGORY_OVERRIDES: [RegExp, string, string][] = [
  // Electronics - Cell Phones & Smartphones
  [/\biphone\b/i,           '9355', 'Cell Phones & Smartphones'],
  [/\bsamsung\s*galaxy\b/i, '9355', 'Cell Phones & Smartphones'],
  [/\bpixel\b/i,            '9355', 'Cell Phones & Smartphones'],
  [/\bsmartphone\b/i,       '9355', 'Cell Phones & Smartphones'],
  [/\bmobile\s*phone\b/i,   '9355', 'Cell Phones & Smartphones'],
  [/\bcell\s*phone\b/i,     '9355', 'Cell Phones & Smartphones'],

  // Automotive - Car Audio & Electronics
  [/\bcar\s*radio\b/i,      '15032', 'Car Audio & Video'],
  [/\bcar\s*stereo\b/i,     '15032', 'Car Audio & Video'],
  [/\bcar\s*audio\b/i,      '15032', 'Car Audio & Video'],
  [/\bcarplay\b/i,          '15032', 'Car Audio & Video'],
  [/\bandroid\s*auto\b/i,   '15032', 'Car Audio & Video'],

  // Electronics - Computers
  [/\bmacbook\b/i,          '177', 'Computers/Tablets & Networking'],
  [/\blaptop\b/i,           '177', 'Computers/Tablets & Networking'],
  [/\bnotebook\b/i,         '177', 'Computers/Tablets & Networking'],
  [/\bipad\b/i,             '171485', 'iPad/Tablet/eBook Accessories'],

  // Gaming
  [/\bplaystation\s*5\b/i,  '139973', 'Video Game Consoles'],
  [/\bps5\b/i,              '139973', 'Video Game Consoles'],
  [/\bxbox\s*series\b/i,    '139973', 'Video Game Consoles'],
  [/\bnintendo\s*switch\b/i,'139973', 'Video Game Consoles'],

  // Audio
  [/\bairpods\b/i,          '15052', 'Portable Audio & Headphones'],
  [/\bheadphones\b/i,       '15052', 'Portable Audio & Headphones'],
  [/\bearbuds\b/i,          '15052', 'Portable Audio & Headphones'],

  // TV & Video
  [/\bapple\s*tv\b/i,       '67729', 'Streaming Media Players'],
  [/\broku\b/i,             '67729', 'Streaming Media Players'],
  [/\bfirestick\b/i,        '67729', 'Streaming Media Players'],
];

/**
 * Fast category override using regex patterns
 * Returns category ID if a pattern matches, undefined otherwise
 */
export function getOverrideCategory(query: string): { categoryId: string; categoryName: string } | undefined {
  if (!query || query.trim().length === 0) {
    return undefined;
  }

  for (const [regex, categoryId, categoryName] of CATEGORY_OVERRIDES) {
    if (regex.test(query)) {
      console.log(`🔖 Override matched "${regex.source}" → ${categoryId} (${categoryName})`);
      return { categoryId, categoryName };
    }
  }

  return undefined;
}

// ===============================
// UTILITY FUNCTIONS
// ===============================

/**
 * Get OAuth token for eBay API calls
 */
async function getEbayOAuthToken(): Promise<string> {
  // Frontend: Use existing supabase client approach
  const { supabase } = await import('./supabase');
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Authentication required for category detection');
  }
  
  // We'll call our Supabase function for taxonomy data
  return session.access_token;
}

/**
 * Normalize text for keyword matching
 */
function normalizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Remove punctuation
    .replace(/\s+/g, ' ')      // Collapse whitespace
    .trim();
}

/**
 * Generate keywords from category name and path
 */
function generateKeywords(categoryName: string, categoryPath: string): string[] {
  const keywords = new Set<string>();
  
  // Add words from category name
  const nameWords = normalizeText(categoryName || '').split(' ').filter(word => word.length > 2);
  nameWords.forEach(word => keywords.add(word));
  
  // Add words from full path
  const pathWords = normalizeText(categoryPath || '').split(' ').filter(word => word.length > 2);
  pathWords.forEach(word => keywords.add(word));
  
  // Add synonyms
  nameWords.forEach(word => {
    if (KEYWORD_SYNONYMS[word]) {
      KEYWORD_SYNONYMS[word].forEach(synonym => keywords.add(synonym));
    }
  });
  
  // Remove common stop words
  const stopWords = new Set(['and', 'the', 'for', 'with', 'other', 'more', 'all', 'new', 'used', 'accessories']);
  return Array.from(keywords).filter(keyword => !stopWords.has(keyword));
}

/**
 * Build category path string from node hierarchy
 */
function buildCategoryPath(node: TaxonomyNode, parentPath: string = ''): string {
  const currentPath = parentPath ? `${parentPath} > ${node.categoryName}` : node.categoryName;
  return currentPath;
}

/**
 * Unwrap a taxonomy node that may be wrapped with a category property
 */
function unwrapNode(node: any): { 
  unwrappedNode: TaxonomyNode | null; 
  wrapperChildren: any[] 
} {
  // If node has a category property, it's a wrapper
  if (node && node.category) {
    return {
      unwrappedNode: {
        categoryId: node.category.categoryId,
        categoryName: node.category.categoryName,
        categoryTreeNodeLevel: node.category.categoryTreeNodeLevel,
        parentCategoryTreeNodeId: node.category.parentCategoryTreeNodeId,
        leafCategoryTreeNode: node.category.leafCategoryTreeNode,
        childCategoryTreeNodes: node.category.childCategoryTreeNodes || []
      },
      wrapperChildren: node.childCategoryTreeNodes || []
    };
  }
  
  // Otherwise, treat as a direct node
  return {
    unwrappedNode: node,
    wrapperChildren: node?.childCategoryTreeNodes || []
  };
}

/**
 * Recursively traverse taxonomy tree and extract leaf categories
 */
function extractLeafCategories(
  node: any, 
  parentPath: string = '',
  level: number = 0
): CategoryDef[] {
  const categories: CategoryDef[] = [];
  
  // Unwrap the node to get the real category data
  const { unwrappedNode, wrapperChildren } = unwrapNode(node);
  
  // Skip if unwrapped node is invalid
  if (!unwrappedNode || !unwrappedNode.categoryId || !unwrappedNode.categoryName) {
    return categories;
  }
  
  const currentPath = buildCategoryPath(unwrappedNode, parentPath);
  
  // Skip excluded categories (motors, etc.)
  if (EXCLUDED_CATEGORIES.has(unwrappedNode.categoryId)) {
    console.log(`🚫 Skipping excluded category: ${unwrappedNode.categoryName} (${unwrappedNode.categoryId})`);
    return categories;
  }
  
  // If this is a leaf node, add it to our categories
  if (unwrappedNode.leafCategoryTreeNode || wrapperChildren.length === 0) {
    try {
      const keywords = generateKeywords(unwrappedNode.categoryName, currentPath);
      
      categories.push({
        categoryId: unwrappedNode.categoryId,
        categoryName: unwrappedNode.categoryName,
        categoryPath: currentPath,
        keywords,
        level,
        parentId: unwrappedNode.parentCategoryTreeNodeId
      });
    } catch (error) {
      console.warn('⚠️ Error processing category keywords:', unwrappedNode.categoryName, error);
    }
  }
  
  // Recursively process children from the wrapper level
  if (wrapperChildren && Array.isArray(wrapperChildren)) {
    for (const child of wrapperChildren) {
      try {
        categories.push(...extractLeafCategories(child, currentPath, level + 1));
      } catch (error) {
        console.warn('⚠️ Error processing child category:', child?.category?.categoryName || child?.categoryName, error);
      }
    }
  }
  
  return categories;
}

// ===============================
// MAIN API FUNCTIONS
// ===============================

/**
 * Fetch eBay taxonomy from the Commerce Taxonomy API
 */
export async function fetchEbayTaxonomy(): Promise<TaxonomyResponse> {
  console.log('🌳 Fetching eBay taxonomy from Commerce API...');
  
  try {
    // Frontend: Call through Supabase function
    const { supabase } = await import('./supabase');
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Authentication required for taxonomy data');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebay-taxonomy`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch taxonomy: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('💥 Error fetching eBay taxonomy:', error);
    throw error;
  }
}

/**
 * Load and process eBay categories from cache or API
 */
export async function loadCategories(forceRefresh: boolean = false): Promise<CategoryDef[]> {
  // Check cache first
  if (!forceRefresh && categoryCache && (Date.now() - categoryCache.lastUpdated) < CACHE_DURATION_MS) {
    console.log('📋 Using cached category data');
    return categoryCache.categories;
  }
  
  console.log('🔄 Loading fresh category data...');
  
  try {
    const taxonomy = await fetchEbayTaxonomy();
    const categories = extractLeafCategories(taxonomy.rootCategoryNode);
    
    // Update cache
    categoryCache = {
      categories,
      lastUpdated: Date.now(),
      version: taxonomy.categoryTreeVersion
    };
    
    console.log('✅ Categories loaded and cached');
    console.log(`  - Total categories: ${categories.length}`);
    console.log(`  - Sample categories:`, categories.slice(0, 3).map(c => `${c.categoryName} (${c.categoryId})`));
    
    return categories;
  } catch (error) {
    console.error('💥 Error loading categories:', error);
    
    // If we have stale cache data, use it as fallback
    if (categoryCache && categoryCache.categories.length > 0) {
      console.log('⚠️ Using stale cache data as fallback');
      return categoryCache.categories;
    }
    
    throw error;
  }
}

/**
 * Pick the best category for a search query using override map first, then keyword matching
 */
export function pickCategory(query: string, categories?: CategoryDef[]): string | undefined {
  if (!query || query.trim().length === 0) {
    return undefined;
  }
  
  console.log(`🎯 Picking category for query: "${query}"`);
  
  // Step 1: Try override map first (fast path)
  const override = getOverrideCategory(query);
  if (override) {
    console.log(`✅ Override category selected: ${override.categoryName} (${override.categoryId})`);
    return override.categoryId;
  }
  
  // Step 2: Fall back to complex taxonomy-based matching
  console.log('🔍 No override found, trying taxonomy-based detection...');
  
  // Use provided categories or cache
  const cats = categories || categoryCache?.categories;
  if (!cats || cats.length === 0) {
    console.log('⚠️ No categories available for matching');
    return undefined;
  }
  
  // Normalize query
  const normalizedQuery = normalizeText(query);
  const queryTokens = normalizedQuery.split(' ').filter(token => token.length > 2);
  
  if (queryTokens.length === 0) {
    return undefined;
  }
  
  // Score each category
  const categoryScores: { category: CategoryDef; score: number; matches: string[] }[] = [];
  
  for (const category of cats) {
    let score = 0;
    const matches: string[] = [];
    
    // Check each query token against category keywords
    for (const token of queryTokens) {
      for (const keyword of category.keywords) {
        if (keyword === token) {
          score += 3; // Exact match
          matches.push(keyword);
        } else if (keyword.includes(token) || token.includes(keyword)) {
          score += 1; // Partial match
          matches.push(keyword);
        }
      }
    }
    
    // Boost score for shorter paths (more specific categories)
    if (score > 0) {
      score += Math.max(0, 5 - category.level);
      categoryScores.push({ category, score, matches });
    }
  }
  
  // Sort by score (highest first)
  categoryScores.sort((a, b) => b.score - a.score);
  
  // Debug logging
  if (config.debug.showConsoleMessages && categoryScores.length > 0) {
    console.log('🏆 Top category matches:');
    categoryScores.slice(0, 5).forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.category.categoryName} (${item.category.categoryId}) - Score: ${item.score}`);
      console.log(`     Path: ${item.category.categoryPath}`);
      console.log(`     Matches: ${item.matches.join(', ')}`);
    });
  }
  
  // Return the best match if it has a reasonable score
  const bestMatch = categoryScores[0];
  if (bestMatch && bestMatch.score >= 3) { // Require at least one exact match
    console.log(`✅ Taxonomy-based category selected: ${bestMatch.category.categoryName} (${bestMatch.category.categoryId})`);
    return bestMatch.category.categoryId;
  }
  
  console.log('❌ No suitable category found');
  return undefined;
}

/**
 * Initialize the category system and set up auto-refresh
 */
export async function initializeCategorySystem(): Promise<void> {
  console.log('🚀 Initializing eBay category detection system...');
  
  try {
    // Load initial categories
    await loadCategories();
    
    console.log('✅ Category system initialized successfully');
  } catch (error) {
    console.error('💥 Failed to initialize category system:', error);
    throw error;
  }
}

/**
 * Get category information by ID
 */
export function getCategoryInfo(categoryId: string, categories?: CategoryDef[]): CategoryDef | undefined {
  const cats = categories || categoryCache?.categories;
  return cats?.find(cat => cat.categoryId === categoryId);
}

/**
 * Search for categories by name or keyword
 */
export function searchCategories(searchTerm: string, categories?: CategoryDef[]): CategoryDef[] {
  const cats = categories || categoryCache?.categories;
  if (!cats) return [];
  
  const normalizedSearch = normalizeText(searchTerm);
  
  return cats.filter(category => 
    normalizeText(category.categoryName).includes(normalizedSearch) ||
    normalizeText(category.categoryPath).includes(normalizedSearch) ||
    category.keywords.some(keyword => keyword.includes(normalizedSearch))
  ).slice(0, 20); // Limit results
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { cached: boolean; lastUpdated?: Date; categoriesCount?: number; version?: string } {
  if (!categoryCache) {
    return { cached: false };
  }
  
  return {
    cached: true,
    lastUpdated: new Date(categoryCache.lastUpdated),
    categoriesCount: categoryCache.categories.length,
    version: categoryCache.version
  };
}