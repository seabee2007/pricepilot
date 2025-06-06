import { ItemSummary, SearchFilters } from '../types';
import { supabase } from './supabase';

export async function searchLiveItems(
  query: string, 
  filters: SearchFilters = {},
  pageSize: number = 50,
  pageOffset: number = 0
): Promise<ItemSummary[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebay-search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        filters,
        pageSize,
        pageOffset,
        mode: 'live'
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to search eBay');
    }

    const data = await response.json();
    return data.items || [];
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
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebay-search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        filters,
        pageSize,
        pageOffset,
        mode: 'completed'
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to search eBay');
    }

    const data = await response.json();
    return data.items || [];
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