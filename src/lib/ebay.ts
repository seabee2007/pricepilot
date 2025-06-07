import { ItemSummary, SearchFilters, VehicleCompatibility, ItemCompatibility, DealItem, EbayEvent, EventItem, DealSearchFilters, EventSearchFilters } from '../types';
import { supabase } from './supabase';
import { config } from './config';

// Rate limiting and request deduplication
const requestCache = new Map<string, Promise<any>>();
const lastRequestTime = new Map<string, number>();
const MIN_REQUEST_INTERVAL = config.rateLimit.minRequestInterval;
const MAX_CONCURRENT_REQUESTS = config.rateLimit.maxConcurrentRequests;
let activeRequestCount = 0;

function createRequestKey(endpoint: string, params: any): string {
  return `${endpoint}:${JSON.stringify(params)}`;
}

function shouldThrottleRequest(key: string): boolean {
  const lastTime = lastRequestTime.get(key);
  if (lastTime && Date.now() - lastTime < MIN_REQUEST_INTERVAL) {
    return true;
  }
  
  // Also check if we have too many concurrent requests
  if (activeRequestCount >= MAX_CONCURRENT_REQUESTS) {
    return true;
  }
  
  return false;
}

async function makeThrottledRequest<T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> {
  // Check if we should throttle this request
  if (shouldThrottleRequest(key)) {
    const lastTime = lastRequestTime.get(key);
    const timeRemaining = lastTime ? Math.ceil((MIN_REQUEST_INTERVAL - (Date.now() - lastTime)) / 1000) : 0;
    
    if (activeRequestCount >= MAX_CONCURRENT_REQUESTS) {
      throw new Error(`Too many concurrent requests (${activeRequestCount}/${MAX_CONCURRENT_REQUESTS}). Please wait and try again.`);
    } else {
      throw new Error(`Rate limit exceeded. Please wait ${timeRemaining} seconds before making another identical request.`);
    }
  }

  // Check if there's already a pending request for this key
  if (requestCache.has(key)) {
    if (config.debug.showConsoleMessages) {
      console.log(`Reusing pending request for: ${key.split(':')[0]}`);
    }
    return requestCache.get(key);
  }

  // Increment active request counter
  activeRequestCount++;
  if (config.debug.showConsoleMessages) {
    console.log(`Starting request ${activeRequestCount}/${MAX_CONCURRENT_REQUESTS}: ${key.split(':')[0]}`);
  }

  // Make the request
  const promise = requestFn()
    .finally(() => {
      // Clean up cache and update last request time
      requestCache.delete(key);
      lastRequestTime.set(key, Date.now());
      activeRequestCount--;
      if (config.debug.showConsoleMessages) {
        console.log(`Completed request. Active: ${activeRequestCount}/${MAX_CONCURRENT_REQUESTS}`);
      }
    });

  requestCache.set(key, promise);
  return promise;
}

export async function searchLiveItems(
  query: string, 
  filters: SearchFilters = {},
  pageSize: number = 50,
  pageOffset: number = 0,
  fieldgroups: string[] = []
): Promise<ItemSummary[]> {
  console.log('🔍 searchLiveItems called with:', { query, filters, pageSize, pageOffset, fieldgroups });
  
  // Check environment variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  console.log('🔧 Environment check:');
  console.log('  VITE_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.log('  VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set' : '❌ Missing');
  
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL environment variable is not set');
  }
  
  const requestKey = createRequestKey('searchLiveItems', { query, filters, pageSize, pageOffset, fieldgroups });
  
  return makeThrottledRequest(requestKey, async () => {
    try {
      console.log('🔑 Getting Supabase session...');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Authentication required. Please sign in to search eBay.');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey, // Required for Supabase functions
        'Authorization': `Bearer ${session.access_token}`,
      };
      
      console.log('✅ Session found, authenticated user:', session.user.id);

      // Ensure we include both auction and fixed price items by default for broader results
      const enhancedFilters = {
        ...filters,
        // Don't override if user explicitly set buyItNowOnly or auctionOnly
        ...((!filters.buyItNowOnly && !filters.auctionOnly) ? {} : {})
      };

      const functionUrl = `${supabaseUrl}/functions/v1/ebay-search`;
      
      console.log('🌐 Making request to:', functionUrl);
      console.log('📦 Request payload:', {
        query: query.trim(),
        filters: enhancedFilters,
        pageSize: Math.min(Math.max(pageSize, 1), 200),
        pageOffset: Math.max(pageOffset, 0),
        mode: 'live',
        fieldgroups
      });

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: query.trim(),
          filters: enhancedFilters,
          pageSize: Math.min(Math.max(pageSize, 1), 200),
          pageOffset: Math.max(pageOffset, 0),
          mode: 'live',
          fieldgroups
        }),
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response not ok. Error text:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          console.error('❌ Parsed error data:', errorData);
          
          if (response.status === 401) {
            throw new Error('Authentication failed. Please sign in again.');
          }
          
          throw new Error(errorData.error || 'Failed to search eBay');
        } catch (parseError) {
          console.error('❌ Could not parse error response:', parseError);
          
          if (response.status === 401) {
            throw new Error('Authentication failed. Please sign in again.');
          }
          
          throw new Error(`eBay API error: ${response.status} - ${errorText}`);
        }
      }

      const data = await response.json();
      console.log('✅ eBay API Response received:', data);
      return data.items || [];
    } catch (error) {
      console.error('💥 Error in searchLiveItems:', error);
      throw error;
    }
  });
}

export async function searchCompletedItems(
  query: string, 
  filters: SearchFilters = {},
  pageSize: number = 50,
  pageOffset: number = 0
): Promise<ItemSummary[]> {
  const requestKey = createRequestKey('searchCompletedItems', { query, filters, pageSize, pageOffset });
  
  return makeThrottledRequest(requestKey, async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Authentication required. Please sign in to search eBay.');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
      };

      console.log('Searching completed items with query:', query);
      console.log('Filters:', filters);
      console.log('Authenticated user:', session.user.id);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebay-search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: query.trim(),
          filters,
          pageSize: Math.min(Math.max(pageSize, 1), 200),
          pageOffset: Math.max(pageOffset, 0),
          mode: 'completed'
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        try {
          const errorData = JSON.parse(errorText);
          
          if (response.status === 401) {
            throw new Error('Authentication failed. Please sign in again.');
          }
          
          throw new Error(errorData.error || 'Failed to search eBay');
        } catch (parseError) {
          if (response.status === 401) {
            throw new Error('Authentication failed. Please sign in again.');
          }
          
          throw new Error(`eBay API error: ${response.status} - ${errorText}`);
        }
      }

      const data = await response.json();
      console.log('eBay API Response:', data);
      return data.items || [];
    } catch (error) {
      console.error('Error searching completed items:', error);
      throw error;
    }
  });
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

/**
 * Search for items compatible with a specific vehicle
 * This uses the eBay Browse API's compatibility_filter parameter
 */
export async function searchCompatibleItems(
  query: string,
  vehicleCompatibility: VehicleCompatibility,
  filters: SearchFilters = {},
  pageSize: number = 50,
  pageOffset: number = 0
): Promise<ItemSummary[]> {
  const requestKey = createRequestKey('searchCompatibleItems', { query, vehicleCompatibility, filters, pageSize, pageOffset });
  
  return makeThrottledRequest(requestKey, async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Authentication required');
      }

      // Add compatibility filter to the search filters
      const enhancedFilters = {
        ...filters,
        compatibilityFilter: vehicleCompatibility
      };

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebay-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          filters: enhancedFilters,
          pageSize,
          pageOffset,
          mode: 'live'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to search compatible items');
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Error searching compatible items:', error);
      throw error;
    }
  });
}

/**
 * Check if a specific item is compatible with a vehicle
 * This uses the eBay Browse API's check_compatibility endpoint
 */
export async function checkItemCompatibility(
  itemId: string,
  vehicleCompatibility: VehicleCompatibility
): Promise<ItemCompatibility> {
  const requestKey = createRequestKey('checkItemCompatibility', { itemId, vehicleCompatibility });
  
  return makeThrottledRequest(requestKey, async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebay-search/check_compatibility`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId,
          compatibility: vehicleCompatibility
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check item compatibility');
      }

      return await response.json();
    } catch (error) {
      console.error('Error checking item compatibility:', error);
      throw error;
    }
  });
}

/**
 * Validate vehicle compatibility data based on vehicle type
 */
export function validateVehicleCompatibility(compatibility: VehicleCompatibility): string[] {
  const errors: string[] = [];
  
  if (!compatibility.year) errors.push('Year is required');
  if (!compatibility.make) errors.push('Make is required');
  if (!compatibility.model) errors.push('Model is required');
  
  if (compatibility.vehicleType === 'motorcycle') {
    if (!compatibility.submodel) errors.push('Submodel is required for motorcycles');
  } else {
    // For cars and trucks
    if (!compatibility.trim) errors.push('Trim is required for cars and trucks');
    if (!compatibility.engine) errors.push('Engine is required for cars and trucks');
  }
  
  return errors;
}

/**
 * Get automotive categories commonly used for parts and accessories
 */
export function getAutomotiveCategories(): { id: string; name: string }[] {
  return [
    { id: '6028', name: 'eBay Motors' },
    { id: '33559', name: 'Car & Truck Parts & Accessories' },
    { id: '10063', name: 'Motorcycle Parts' },
    { id: '6750', name: 'Tires & Wheels' },
    { id: '33743', name: 'Performance & Racing Parts' },
    { id: '33649', name: 'Brakes & Brake Parts' },
    { id: '33567', name: 'Engine & Engine Parts' },
    { id: '33710', name: 'Transmission & Drivetrain' },
    { id: '33675', name: 'Electrical Components' },
    { id: '33654', name: 'Cooling System' },
    { id: '33641', name: 'Air Intake & Fuel Delivery' },
    { id: '33696', name: 'Suspension & Steering' },
    { id: '33564', name: 'Body Parts' },
    { id: '33580', name: 'Exterior' },
    { id: '33588', name: 'Interior' }
  ];
}

// ===== DEAL API FUNCTIONS =====
// Note: These require special approval from eBay (Limited Release API)

/**
 * Get deal items from eBay Deal API
 * Requires special approval for production use
 */
export async function getDealItems(filters: DealSearchFilters = {}): Promise<DealItem[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebay-deals/deal_items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filters }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get deal items');
    }

    const data = await response.json();
    return data.dealItems || [];
  } catch (error) {
    console.error('Error getting deal items:', error);
    throw error;
  }
}

/**
 * Get all eBay events for the marketplace
 * Requires special approval for production use
 */
export async function getEbayEvents(filters: EventSearchFilters = {}): Promise<EbayEvent[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebay-deals/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filters }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get events');
    }

    const data = await response.json();
    return data.events || [];
  } catch (error) {
    console.error('Error getting events:', error);
    throw error;
  }
}

/**
 * Get a specific eBay event by ID
 * Requires special approval for production use
 */
export async function getEbayEvent(eventId: string): Promise<EbayEvent> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebay-deals/events/${eventId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get event');
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting event:', error);
    throw error;
  }
}

/**
 * Get event items associated with eBay events
 * Requires special approval for production use
 */
export async function getEventItems(filters: EventSearchFilters = {}): Promise<EventItem[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebay-deals/event_items`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filters }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get event items');
    }

    const data = await response.json();
    return data.eventItems || [];
  } catch (error) {
    console.error('Error getting event items:', error);
    throw error;
  }
}

/**
 * Calculate potential savings from deal items
 */
export function calculateDealSavings(dealItems: DealItem[]): {
  totalSavings: number;
  averageDiscount: number;
  bestDeal: DealItem | null;
} {
  if (!dealItems || dealItems.length === 0) {
    return { totalSavings: 0, averageDiscount: 0, bestDeal: null };
  }

  let totalSavings = 0;
  let totalDiscountPercentages = 0;
  let validDiscounts = 0;
  let bestDeal: DealItem | null = null;
  let maxSavings = 0;

  dealItems.forEach(item => {
    if (item.discountAmount?.value) {
      totalSavings += item.discountAmount.value;
      
      if (item.discountAmount.value > maxSavings) {
        maxSavings = item.discountAmount.value;
        bestDeal = item;
      }
    }

    if (item.discountPercentage) {
      const percentage = parseFloat(item.discountPercentage.replace('%', ''));
      if (!isNaN(percentage)) {
        totalDiscountPercentages += percentage;
        validDiscounts++;
      }
    }
  });

  const averageDiscount = validDiscounts > 0 ? totalDiscountPercentages / validDiscounts : 0;

  return {
    totalSavings,
    averageDiscount,
    bestDeal
  };
}

/**
 * Check if Deal API access is available
 * This is a utility function to test API availability
 */
export async function checkDealApiAccess(): Promise<{
  available: boolean;
  message: string;
}> {
  try {
    await getDealItems({ limit: 1 });
    return {
      available: true,
      message: 'Deal API access is available'
    };
  } catch (error: any) {
    if (error.message.includes('Deal API access restricted')) {
      return {
        available: false,
        message: 'Deal API requires special approval from eBay (Limited Release API)'
      };
    }
    
    return {
      available: false,
      message: error.message
    };
  }
}

/**
 * Simple test function to debug eBay API integration
 * Run this in browser console: await window.testEbayApi()
 */
export async function testEbayApi() {
  console.log('🧪 Testing eBay API...');
  
  try {
    const result = await searchLiveItems('test', {}, 5, 0);
    console.log('✅ Test successful! Found items:', result.length);
    console.log('Sample items:', result.slice(0, 2));
    return result;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Make it available globally for testing
if (typeof window !== 'undefined') {
  (window as any).testEbayApi = testEbayApi;
  
  // Add a more comprehensive test function
  (window as any).testSearchAndLog = async function(query = 'test', pageSize = 10) {
    console.log('🧪 Starting comprehensive search test...');
    console.log('Query:', query, 'Page Size:', pageSize);
    
    try {
      console.log('1️⃣ Testing searchLiveItems directly...');
      const results = await searchLiveItems(query, {}, pageSize, 0);
      console.log('✅ Direct API call successful! Results:', results);
      
      console.log('2️⃣ Testing if ResultsList can handle this data...');
      console.log('Sample item structure:', results[0]);
      
      return {
        success: true,
        itemCount: results.length,
        results: results,
        sampleItem: results[0]
      };
    } catch (error) {
      console.error('❌ Test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  };
}

/**
 * Get detailed information for a specific item using eBay Browse API
 * Uses the /item/{item_id} endpoint with fieldgroups for detailed response
 */
export async function getItemDetails(
  itemId: string,
  fieldgroups: string[] = ['PRODUCT', 'ADDITIONAL_SELLER_DETAILS', 'COMPATIBILITY']
): Promise<any> {
  const requestKey = createRequestKey('getItemDetails', { itemId, fieldgroups });
  
  return makeThrottledRequest(requestKey, async () => {
    try {
      console.log('🔍 Getting detailed item info for:', itemId);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Authentication required. Please sign in.');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
      };

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebay-item-details`;
      
      console.log('🌐 Making request to:', functionUrl);
      console.log('📦 Request payload:', { itemId, fieldgroups });

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          itemId,
          fieldgroups
        }),
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response not ok. Error text:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          console.error('❌ Parsed error data:', errorData);
          
          if (response.status === 401) {
            throw new Error('Authentication failed. Please sign in again.');
          }
          
          throw new Error(errorData.error || 'Failed to get item details');
        } catch (parseError) {
          console.error('❌ Could not parse error response:', parseError);
          
          if (response.status === 401) {
            throw new Error('Authentication failed. Please sign in again.');
          }
          
          throw new Error(`eBay API error: ${response.status} - ${errorText}`);
        }
      }

      const data = await response.json();
      console.log('✅ eBay Item Details Response received:', data);
      return data;
    } catch (error) {
      console.error('💥 Error in getItemDetails:', error);
      throw error;
    }
  });
}

/**
 * Get details for multiple items using eBay Browse API
 * Uses the /item/ endpoint to get abbreviated details for multiple items efficiently
 */
export async function getMultipleItems(
  itemIds: string[],
  itemGroupIds: string[] = []
): Promise<any[]> {
  const requestKey = createRequestKey('getMultipleItems', { itemIds, itemGroupIds });
  
  return makeThrottledRequest(requestKey, async () => {
    try {
      console.log('🔍 Getting details for multiple items:', itemIds.length, 'items');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Authentication required. Please sign in.');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
      };

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebay-multiple-items`;
      
      console.log('🌐 Making request to:', functionUrl);
      console.log('📦 Request payload:', { itemIds, itemGroupIds });

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          itemIds,
          itemGroupIds
        }),
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response not ok. Error text:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          console.error('❌ Parsed error data:', errorData);
          
          if (response.status === 401) {
            throw new Error('Authentication failed. Please sign in again.');
          }
          
          throw new Error(errorData.error || 'Failed to get multiple items');
        } catch (parseError) {
          console.error('❌ Could not parse error response:', parseError);
          
          if (response.status === 401) {
            throw new Error('Authentication failed. Please sign in again.');
          }
          
          throw new Error(`eBay API error: ${response.status} - ${errorText}`);
        }
      }

      const data = await response.json();
      console.log('✅ eBay Multiple Items Response received:', data.items?.length || 0, 'items');
      return data.items || [];
    } catch (error) {
      console.error('💥 Error in getMultipleItems:', error);
      throw error;
    }
  });
}

/**
 * Search for parts/accessories compatible with a specific vehicle
 * Uses eBay Browse API compatibility_filter - based on Sample 10
 * Format: Year:2018;Make:BMW;Model:318i;Trim:Executive Sedan 4-Door;Engine:1.5L 1499CC l3 GAS DOHC Turbocharged
 */
export async function searchVehicleCompatibleParts(
  query: string,
  vehicle: {
    year: string;
    make: string;
    model: string;
    trim?: string;
    engine?: string;
    submodel?: string; // For motorcycles
    vehicleType?: 'car' | 'truck' | 'motorcycle';
  },
  categoryId: string = '33559', // Car & Truck Brakes & Brake Parts by default
  pageSize: number = 50,
  pageOffset: number = 0
): Promise<ItemSummary[]> {
  const requestKey = createRequestKey('searchVehicleCompatibleParts', { query, vehicle, categoryId, pageSize, pageOffset });
  
  return makeThrottledRequest(requestKey, async () => {
    try {
      console.log('🔍 Searching vehicle-compatible parts:', { query, vehicle });
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Authentication required. Please sign in.');
      }

      // Build compatibility filter in the exact format from Sample 10
      const compatibilityParts: string[] = [];
      
      if (vehicle.year) compatibilityParts.push(`Year:${vehicle.year}`);
      if (vehicle.make) compatibilityParts.push(`Make:${vehicle.make}`);
      if (vehicle.model) compatibilityParts.push(`Model:${vehicle.model}`);
      
      if (vehicle.vehicleType === 'motorcycle') {
        if (vehicle.submodel) compatibilityParts.push(`Submodel:${vehicle.submodel}`);
      } else {
        // For cars and trucks - use all available details for best matching
        if (vehicle.trim) compatibilityParts.push(`Trim:${vehicle.trim}`);
        if (vehicle.engine) compatibilityParts.push(`Engine:${vehicle.engine}`);
      }
      
      const compatibilityFilter = compatibilityParts.join(';');
      
      console.log('🔧 Built compatibility filter:', compatibilityFilter);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
      };

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebay-search`;
      
      // Build filters for parts search
      const filters = {
        category: categoryId,
        compatibilityFilter: compatibilityFilter
      };

      console.log('🌐 Making parts compatibility request');
      console.log('📦 Request payload:', {
        query: query.trim(),
        filters,
        pageSize: Math.min(Math.max(pageSize, 1), 200),
        pageOffset: Math.max(pageOffset, 0),
        mode: 'live'
      });

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: query.trim(),
          filters,
          pageSize: Math.min(Math.max(pageSize, 1), 200),
          pageOffset: Math.max(pageOffset, 0),
          mode: 'live'
        }),
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response not ok. Error text:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          console.error('❌ Parsed error data:', errorData);
          
          if (response.status === 401) {
            throw new Error('Authentication failed. Please sign in again.');
          }
          
          throw new Error(errorData.error || 'Failed to search vehicle-compatible parts');
        } catch (parseError) {
          console.error('❌ Could not parse error response:', parseError);
          
          if (response.status === 401) {
            throw new Error('Authentication failed. Please sign in again.');
          }
          
          throw new Error(`eBay API error: ${response.status} - ${errorText}`);
        }
      }

      const data = await response.json();
      console.log('✅ Vehicle Parts Compatibility Response received:', data);
      console.log('  - Items found:', data.items?.length || 0);
      
      // Log compatibility information if available
      if (data.items && data.items.length > 0 && data.items[0].compatibilityMatch) {
        console.log('  - Compatibility match:', data.items[0].compatibilityMatch);
        console.log('  - Compatibility properties:', data.items[0].compatibilityProperties?.length || 0);
      }
      
      return data.items || [];
    } catch (error) {
      console.error('💥 Error in searchVehicleCompatibleParts:', error);
      throw error;
    }
  });
}

/**
 * Get automotive parts categories for use with vehicle compatibility search
 * Based on Sample 10 and common automotive part categories
 */
export function getAutomotivePartsCategories(): { id: string; name: string; description: string }[] {
  return [
    { id: '33559', name: 'Car & Truck Brakes & Brake Parts', description: 'Brake pads, rotors, calipers, brake lines' },
    { id: '33567', name: 'Engine & Engine Parts', description: 'Engine components, gaskets, filters' },
    { id: '33649', name: 'Brakes & Brake Parts', description: 'All brake-related components' },
    { id: '33675', name: 'Electrical Components', description: 'Wiring, sensors, electrical parts' },
    { id: '33654', name: 'Cooling System', description: 'Radiators, thermostats, cooling parts' },
    { id: '33710', name: 'Transmission & Drivetrain', description: 'Transmission parts, driveshaft components' },
    { id: '33696', name: 'Suspension & Steering', description: 'Shocks, struts, steering components' },
    { id: '6750', name: 'Tires & Wheels', description: 'Tires, rims, wheel accessories' },
    { id: '33564', name: 'Body Parts', description: 'Bumpers, fenders, body panels' },
    { id: '33588', name: 'Interior', description: 'Seats, dashboard, interior accessories' },
    { id: '33580', name: 'Exterior', description: 'Mirrors, trim, exterior accessories' }
  ];
}

/**
 * Enhanced vehicle search with extended data (shortDescription, location details, etc.)
 * Based on Sample 6 - uses fieldgroups=EXTENDED,MATCHING_ITEMS for richer data
 */
export async function searchVehiclesExtended(
  query: string,
  vehicleFilters: {
    make?: string;
    model?: string;
    year?: string;
    yearFrom?: string;
    yearTo?: string;
    bodyStyle?: string;
    driveType?: string;
    fuelType?: string;
    transmission?: string;
  },
  additionalFilters: SearchFilters = {},
  pageSize: number = 50,
  pageOffset: number = 0
): Promise<ItemSummary[]> {
  console.log('🔍 Enhanced vehicle search with extended data:', { query, vehicleFilters });
  
  // Build comprehensive search filters
  const filters: SearchFilters = {
    category: 'motors',
    vehicleAspects: vehicleFilters,
    ...additionalFilters
  };
  
  // Use fieldgroups for extended data (Sample 6 format)
  const fieldgroups = ['EXTENDED', 'MATCHING_ITEMS'];
  
  return searchLiveItems(query, filters, pageSize, pageOffset, fieldgroups);
}

/**
 * Get available vehicle aspect options for enhanced filtering
 * Based on common eBay Motors aspects from Sample 6 insights
 */
export function getVehicleAspectOptions(): {
  bodyStyles: string[];
  driveTypes: string[];
  fuelTypes: string[];
  transmissions: string[];
} {
  return {
    bodyStyles: [
      'Sedan',
      'Coupe', 
      'Convertible',
      'Hatchback',
      'SUV',
      'Truck',
      'Van',
      'Wagon',
      'Pickup Truck',
      'Crossover'
    ],
    driveTypes: [
      'FWD',
      'RWD', 
      'AWD',
      '4WD'
    ],
    fuelTypes: [
      'Gasoline',
      'Diesel',
      'Hybrid',
      'Electric',
      'Flex Fuel',
      'Natural Gas'
    ],
    transmissions: [
      'Automatic',
      'Manual',
      'CVT',
      'Semi-Automatic'
    ]
  };
}

/**
 * Get available vehicle aspects using NEW GET endpoint for aspect refinements
 * Uses GET with query parameters: category_ids=6001&fieldgroups=ASPECT_REFINEMENTS
 */
export async function getVehicleAspects(
  make?: string,
  model?: string
): Promise<{
  makes: Array<{ name: string; count: number }>;
  models: Array<{ name: string; count: number }>;
  years: Array<{ name: string; count: number }>;
}> {
  const requestKey = createRequestKey('getVehicleAspects', { make, model });
  
  return makeThrottledRequest(requestKey, async () => {
    try {
      console.log('🔍 Getting vehicle aspects via NEW GET endpoint:', { make, model });
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Authentication required. Please sign in.');
      }

      // Build query parameters for GET request
      const params = new URLSearchParams({
        category_ids: '6001',
        fieldgroups: 'ASPECT_REFINEMENTS'
      });
      
      // Add make/model if specified
      if (make) params.append('make', make);
      if (model) params.append('model', model);

      const headers: Record<string, string> = {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
      };

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebay-vehicle-aspects?${params.toString()}`;
      
      console.log('🌐 GET request to vehicle aspects endpoint');
      console.log('📦 Request URL:', functionUrl);

      const response = await fetch(functionUrl, {
        method: 'GET',
        headers
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Vehicle aspects error:', errorText);
        throw new Error(`Vehicle aspects error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Vehicle aspects response received:', data);
      
      // The edge function now returns structured data with separate arrays
      const makes = data.makes || [];
      const models = data.models || [];
      const years = data.years || [];
      
      console.log('📊 Structured vehicle aspects received:');
      console.log('  - Makes:', makes.length);
      console.log('  - Models:', models.length);
      console.log('  - Years:', years.length);
      
      // Convert to the expected format with 'name' property
      const formattedMakes = makes.map((item: any) => ({
        name: item.value,
        count: item.count
      }));
      
      const formattedModels = models.map((item: any) => ({
        name: item.value,
        count: item.count
      }));
      
      const formattedYears = years.map((item: any) => ({
        name: item.value,
        count: item.count
      }));
      
      return { 
        makes: formattedMakes, 
        models: formattedModels, 
        years: formattedYears 
      };
    } catch (error) {
      console.error('💥 Error in getVehicleAspects:', error);
      throw error;
    }
  });
}