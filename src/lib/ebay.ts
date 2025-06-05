import { ItemSummary, SearchFilters } from '../types';

// Cache for the OAuth token
let tokenCache: {
  access_token: string;
  expires_at: number;
} | null = null;

async function getOAuthToken(): Promise<string> {
  // If token exists and is still valid, return it
  if (tokenCache && tokenCache.expires_at > Date.now()) {
    return tokenCache.access_token;
  }

  const clientId = import.meta.env.VITE_EBAY_CLIENT_ID as string;
  const clientSecret = import.meta.env.VITE_EBAY_CLIENT_SECRET as string;

  if (!clientId || !clientSecret) {
    throw new Error('Missing eBay API credentials');
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);

  try {
    const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    });

    if (!response.ok) {
      throw new Error(`eBay OAuth error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Cache the token with expiration
    tokenCache = {
      access_token: data.access_token,
      expires_at: Date.now() + (data.expires_in * 1000 * 0.9), // 90% of actual expiry time for safety
    };

    return data.access_token;
  } catch (error) {
    console.error('Error fetching eBay OAuth token:', error);
    throw error;
  }
}

function buildFilterString(filters: SearchFilters): string {
  const filterParts: string[] = [];

  // Handle condition IDs properly - eBay expects specific condition codes
  if (filters.conditionIds && filters.conditionIds.length > 0) {
    // Build separate conditionIds filter for each condition
    const conditionFilter = `conditionIds:{${filters.conditionIds.join(',')}}`;
    filterParts.push(conditionFilter);
  }
  
  // Use correct eBay API filter for free shipping
  if (filters.freeShipping) {
    filterParts.push('shippingOptions:{FREE_SHIPPING}');
  }
  
  // Use correct eBay API filter for seller location
  if (filters.sellerLocation) {
    filterParts.push(`sellerLocation:{${filters.sellerLocation}}`);
  }
  
  // Buy It Now filter is already correct
  if (filters.buyItNowOnly) {
    filterParts.push('buyingOptions:{FIXED_PRICE}');
  }

  return filterParts.join(',');
}

export async function searchLiveItems(
  query: string, 
  filters: SearchFilters = {},
  pageSize: number = 50,
  pageOffset: number = 0
): Promise<ItemSummary[]> {
  try {
    const token = await getOAuthToken();
    const filterString = buildFilterString(filters);
    
    const url = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
    url.searchParams.append('q', query);
    url.searchParams.append('sort', 'price');
    
    if (filterString) {
      url.searchParams.append('filter', filterString);
    }
    
    if (filters.postalCode) {
      url.searchParams.append('buyerPostalCode', filters.postalCode);
    }
    
    url.searchParams.append('limit', pageSize.toString());
    
    if (pageOffset > 0) {
      url.searchParams.append('offset', pageOffset.toString());
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`eBay API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.itemSummaries || [];
  } catch (error) {
    console.error('Error searching live items:', error);
    throw error;
  }
}

export async function searchCompletedItems(
  query: string, 
  filters: SearchFilters = {},
  pageSize: number = 50,
  pageOffset: number = 0
): Promise<ItemSummary[]> {
  try {
    const token = await getOAuthToken();
    const filterString = buildFilterString(filters);
    
    const url = new URL('https://api.ebay.com/buy/browse/v1/item_summary/completed');
    url.searchParams.append('q', query);
    url.searchParams.append('sort', 'price_desc');
    
    if (filterString) {
      url.searchParams.append('filter', filterString);
    }
    
    url.searchParams.append('limit', pageSize.toString());
    
    if (pageOffset > 0) {
      url.searchParams.append('offset', pageOffset.toString());
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`eBay API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.itemSummaries || [];
  } catch (error) {
    console.error('Error searching completed items:', error);
    throw error;
  }
}

export function calculateAveragePrice(items: ItemSummary[]): number {
  if (!items || items.length === 0) {
    return 0;
  }
  
  const validPrices = items
    .filter(item => item.price && typeof item.price.value === 'number')
    .map(item => item.price.value);
  
  if (validPrices.length === 0) {
    return 0;
  }
  
  const sum = validPrices.reduce((total, price) => total + price, 0);
  return sum / validPrices.length;
}

/**
 * Builds a canonical eBay Browse API search URL following the official pattern:
 * GET https://api.ebay.com/buy/browse/v1/item_summary/search
 *     ?q=<KEYWORDS>
 *     &filter=<FILTER_EXPRESSIONS>
 *     &sort=<SORT_ORDER>
 *     &limit=<PAGE_SIZE>
 *     &offset=<PAGE_OFFSET>
 *     [&buyerPostalCode=<ZIP>]
 */
export function buildEbaySearchURL(
  query: string,
  filters: SearchFilters = {},
  sortOrder: 'price' | 'price_desc' = 'price',
  pageSize: number = 20,
  pageOffset: number = 0,
  isCompleted: boolean = false
): string {
  // 1) Base URL - live vs completed listings
  const baseUrl = isCompleted 
    ? 'https://api.ebay.com/buy/browse/v1/item_summary/completed'
    : 'https://api.ebay.com/buy/browse/v1/item_summary/search';
  
  const url = new URL(baseUrl);
  
  // 2) URL-encoded keywords
  url.searchParams.append('q', query);
  
  // 3) Build filter string
  const filterString = buildFilterString(filters);
  if (filterString) {
    url.searchParams.append('filter', filterString);
  }
  
  // 4) Sort order
  url.searchParams.append('sort', sortOrder);
  
  // 5) Pagination
  url.searchParams.append('limit', pageSize.toString());
  if (pageOffset > 0) {
    url.searchParams.append('offset', pageOffset.toString());
  }
  
  // 6) Optional postal code param
  if (filters.postalCode) {
    url.searchParams.append('buyerPostalCode', filters.postalCode);
  }
  
  return url.toString();
}