import { ItemSummary, SearchFilters, VehicleCompatibility, ItemCompatibility, DealItem, EbayEvent, EventItem, DealSearchFilters, EventSearchFilters } from '../types';
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
}

/**
 * Check if a specific item is compatible with a vehicle
 * This uses the eBay Browse API's check_compatibility endpoint
 */
export async function checkItemCompatibility(
  itemId: string,
  vehicleCompatibility: VehicleCompatibility
): Promise<ItemCompatibility> {
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