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

  const clientId = import.meta.env.VITE_EBAY_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_EBAY_CLIENT_SECRET;

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

  if (filters.conditionIds && filters.conditionIds.length > 0) {
    filterParts.push(`conditionIds:{${filters.conditionIds.join(',')}}}`);
  }
  
  if (filters.freeShipping) {
    filterParts.push('maxDeliveryCost:0');
  }
  
  if (filters.sellerLocation) {
    filterParts.push(`itemLocation:${filters.sellerLocation}`);
  }
  
  if (filters.buyItNowOnly) {
    filterParts.push('buyingOptions:{FIXED_PRICE}');
  }

  return filterParts.join(',');
}

export async function searchLiveItems(
  query: string, 
  filters: SearchFilters = {}
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
      url.searchParams.append('deliveryPostalCode', filters.postalCode);
    }
    
    url.searchParams.append('limit', '50');

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    });

    if (!response.ok) {
      throw new Error(`eBay API error: ${response.status} ${response.statusText}`);
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
  filters: SearchFilters = {}
): Promise<ItemSummary[]> {
  try {
    const token = await getOAuthToken();
    const filterString = buildFilterString(filters);
    
    const url = new URL('https://api.ebay.com/buy/browse/v1/item_summary/completed');
    url.searchParams.append('q', query);
    url.searchParams.append('sort', '-price'); // Sort by price descending
    
    if (filterString) {
      url.searchParams.append('filter', filterString);
    }
    
    url.searchParams.append('limit', '50');

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    });

    if (!response.ok) {
      throw new Error(`eBay API error: ${response.status} ${response.statusText}`);
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