import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache for the OAuth token
let tokenCache: {
  access_token: string;
  expires_at: number;
} | null = null;

async function getOAuthToken(): Promise<string> {
  // Use the working OAuth application token first
  const oauthToken = Deno.env.get('EBAY_OAUTH_TOKEN');
  
  if (oauthToken) {
    console.log('Using stored OAuth application token');
    return oauthToken;
  }

  console.log('No stored OAuth token found, using client credentials flow...');

  // Fallback to client credentials flow
  if (tokenCache && tokenCache.expires_at > Date.now()) {
    console.log('Using cached client credentials token');
    return tokenCache.access_token;
  }

  const clientId = Deno.env.get('EBAY_CLIENT_ID');
  const clientSecret = Deno.env.get('EBAY_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Missing eBay API credentials (EBAY_CLIENT_ID or EBAY_CLIENT_SECRET)');
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);

  try {
    const oauthUrl = clientId.includes('SBX') 
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token';
      
    console.log(`Requesting fresh OAuth token from: ${oauthUrl}`);
    
    const response = await fetch(oauthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope/buy.browse',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OAuth error response:', errorText);
      throw new Error(`eBay OAuth error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Successfully obtained new OAuth token');
    
    tokenCache = {
      access_token: data.access_token,
      expires_at: Date.now() + (data.expires_in * 1000 * 0.9), // Use 90% of lifetime for safety
    };

    return data.access_token;
  } catch (error) {
    console.error('Error fetching eBay OAuth token:', error);
    throw new Error(`Failed to obtain OAuth token: ${error.message}. Please check your eBay API credentials.`);
  }
}

function buildFilterString(filters: any): string {
  const filterParts: string[] = [];

  // Handle condition IDs properly - eBay expects specific condition codes
  if (filters.conditionIds && filters.conditionIds.length > 0) {
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
  
  // IMPORTANT: Include both auction and fixed price by default unless explicitly filtered
  // This is a common issue - eBay only returns FIXED_PRICE by default
  if (filters.buyItNowOnly) {
    filterParts.push('buyingOptions:{FIXED_PRICE}');
  } else if (filters.auctionOnly) {
    filterParts.push('buyingOptions:{AUCTION}');
  } else {
    // Include both auction and fixed price items for broader results
    filterParts.push('buyingOptions:{AUCTION|FIXED_PRICE}');
  }

  // Enhanced filters based on eBay Browse API documentation
  
  // Price range filter
  if (filters.priceRange) {
    const { min, max, currency = 'USD' } = filters.priceRange;
    if (min !== undefined || max !== undefined) {
      let priceFilter = 'price:[';
      if (min !== undefined && max !== undefined) {
        priceFilter += `${min}..${max}`;
      } else if (min !== undefined) {
        priceFilter += `${min}`;
      } else if (max !== undefined) {
        priceFilter += `..${max}`;
      }
      priceFilter += ']';
      filterParts.push(priceFilter);
      filterParts.push(`priceCurrency:${currency}`);
    }
  }

  // Returns accepted filter
  if (filters.returnsAccepted) {
    filterParts.push('returnsAccepted:true');
  }

  // Search in description filter
  if (filters.searchInDescription) {
    filterParts.push('searchInDescription:true');
  }

  // Seller account type filter
  if (filters.sellerAccountType) {
    filterParts.push(`sellerAccountTypes:{${filters.sellerAccountType}}`);
  }

  // Qualified programs filter
  if (filters.qualifiedPrograms && filters.qualifiedPrograms.length > 0) {
    filterParts.push(`qualifiedPrograms:{${filters.qualifiedPrograms.join('|')}}`);
  }

  // Exclude sellers filter
  if (filters.excludeSellers && filters.excludeSellers.length > 0) {
    filterParts.push(`excludeSellers:{${filters.excludeSellers.join('|')}}`);
  }

  // Charity only filter
  if (filters.charityOnly) {
    filterParts.push('charityOnly:true');
  }

  // Item end date filter
  if (filters.itemEndDate) {
    const { start, end } = filters.itemEndDate;
    if (start || end) {
      let dateFilter = 'itemEndDate:[';
      if (start && end) {
        dateFilter += `${start}..${end}`;
      } else if (start) {
        dateFilter += start;
      } else if (end) {
        dateFilter += `..${end}`;
      }
      dateFilter += ']';
      filterParts.push(dateFilter);
    }
  }

  // Item location country filter
  if (filters.itemLocationCountry) {
    filterParts.push(`itemLocationCountry:${filters.itemLocationCountry}`);
  }

  // Delivery country filter
  if (filters.deliveryCountry) {
    filterParts.push(`deliveryCountry:${filters.deliveryCountry}`);
  }

  // Delivery postal code filter
  if (filters.deliveryPostalCode) {
    filterParts.push(`deliveryPostalCode:${filters.deliveryPostalCode}`);
  }

  return filterParts.join(',');
}

// eBay category ID mapping for better search results
function getCategoryId(category: string): string | null {
  const categoryMap: { [key: string]: string } = {
    'electronics': '293',
    'fashion': '11450',
    'home': '11700',
    'sporting': '888',
    'toys': '220',
    'business': '12576',
    'jewelry': '281',
    'motors': '6001', // Cars & Trucks - this is the specific category for actual vehicles
    'collectibles': '1'
  };
  
  return categoryMap[category] || null;
}

// SIMPLIFIED query processing for automotive searches - MUCH cleaner approach
function enhanceQueryForCategory(query: string, category: string): string {
  // Only enhance queries for motors category
  if (category === 'motors') {
    // Just add a few key positive terms to reinforce vehicle intent
    // The category filter (6001) will do the heavy lifting to exclude toys/parts
    return `${query} vehicle automobile`;
  }
  
  // For all other categories, return query unchanged
  return query;
}

function buildAspectFilter(vehicleAspects: any): string {
  if (!vehicleAspects) return '';
  
  const aspectParts: string[] = [];
  
  // Build aspect filters for vehicle search
  if (vehicleAspects.make) {
    aspectParts.push(`Make:${vehicleAspects.make}`);
  }
  
  if (vehicleAspects.model) {
    aspectParts.push(`Model:${vehicleAspects.model}`);
  }
  
  if (vehicleAspects.year) {
    aspectParts.push(`Year:${vehicleAspects.year}`);
  } else if (vehicleAspects.yearFrom || vehicleAspects.yearTo) {
    // Handle year range
    if (vehicleAspects.yearFrom && vehicleAspects.yearTo) {
      // Create range of years
      const fromYear = parseInt(vehicleAspects.yearFrom);
      const toYear = parseInt(vehicleAspects.yearTo);
      const years = [];
      for (let year = fromYear; year <= toYear; year++) {
        years.push(year.toString());
      }
      if (years.length > 0) {
        aspectParts.push(`Year:{${years.join('|')}}`);
      }
    } else if (vehicleAspects.yearFrom) {
      aspectParts.push(`Year:${vehicleAspects.yearFrom}`);
    } else if (vehicleAspects.yearTo) {
      aspectParts.push(`Year:${vehicleAspects.yearTo}`);
    }
  }
  
  // Don't include categoryId in aspect filter - it's handled separately
  return aspectParts.join(',');
}

function buildCompatibilityFilter(compatibility: any): string {
  if (!compatibility) return '';
  
  const parts: string[] = [];
  
  // Required fields for cars and trucks: Year, Make, Model, Trim, Engine
  // Required fields for motorcycles: Year, Make, Model, Submodel
  
  if (compatibility.year) parts.push(`Year:${compatibility.year}`);
  if (compatibility.make) parts.push(`Make:${compatibility.make}`);
  if (compatibility.model) parts.push(`Model:${compatibility.model}`);
  
  if (compatibility.vehicleType === 'motorcycle') {
    if (compatibility.submodel) parts.push(`Submodel:${compatibility.submodel}`);
  } else {
    // For cars and trucks
    if (compatibility.trim) parts.push(`Trim:${compatibility.trim}`);
    if (compatibility.engine) parts.push(`Engine:${compatibility.engine}`);
  }
  
  return parts.join(';');
}

async function checkItemCompatibility(itemId: string, compatibility: any, token: string): Promise<any> {
  const isSandbox = (Deno.env.get('EBAY_CLIENT_ID') || '').includes('SBX');
  const baseApiUrl = isSandbox 
    ? 'https://api.sandbox.ebay.com/buy/browse/v1/item'
    : 'https://api.ebay.com/buy/browse/v1/item';
  
  const url = `${baseApiUrl}/${itemId}/check_compatibility`;
  
  const compatibilityProperties = [];
  if (compatibility.year) compatibilityProperties.push({ name: 'Year', value: compatibility.year });
  if (compatibility.make) compatibilityProperties.push({ name: 'Make', value: compatibility.make });
  if (compatibility.model) compatibilityProperties.push({ name: 'Model', value: compatibility.model });
  
  if (compatibility.vehicleType === 'motorcycle') {
    if (compatibility.submodel) compatibilityProperties.push({ name: 'Submodel', value: compatibility.submodel });
  } else {
    if (compatibility.trim) compatibilityProperties.push({ name: 'Trim', value: compatibility.trim });
    if (compatibility.engine) compatibilityProperties.push({ name: 'Engine', value: compatibility.engine });
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    },
    body: JSON.stringify({
      compatibilityProperties
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eBay Compatibility API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Require user authentication for production
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { 
          status: 401, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }
    
    console.log('User authenticated:', user.id);

    const url = new URL(req.url);
    const pathname = url.pathname;

    // Handle compatibility check endpoint
    if (pathname.includes('/check_compatibility')) {
      const { itemId, compatibility } = await req.json();
      
      if (!itemId || !compatibility) {
        throw new Error('Item ID and compatibility parameters are required');
      }

      const token = await getOAuthToken();
      const compatibilityResult = await checkItemCompatibility(itemId, compatibility, token);

      return new Response(
        JSON.stringify(compatibilityResult),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Handle search requests
    const { query, filters = {}, pageSize = 50, pageOffset = 0, mode = 'live' } = await req.json();

    if (!query || query.trim() === '') {
      throw new Error('Search query is required and cannot be empty');
    }

    const token = await getOAuthToken();
    const filterString = buildFilterString(filters);
    const compatibilityFilter = buildCompatibilityFilter(filters.compatibilityFilter);
    const aspectFilter = buildAspectFilter(filters.vehicleAspects);
    
    // Choose endpoint based on mode and environment (sandbox vs production)
    const isSandbox = (Deno.env.get('EBAY_CLIENT_ID') || '').includes('SBX');
    const baseApiUrl = isSandbox 
      ? 'https://api.sandbox.ebay.com/buy/browse/v1/item_summary'
      : 'https://api.ebay.com/buy/browse/v1/item_summary';
      
    const baseUrl = mode === 'completed' 
      ? `${baseApiUrl}/completed`
      : `${baseApiUrl}/search`;
    
    const searchUrl = new URL(baseUrl);
    
    // Enhance query for specific categories (much simpler now)
    const enhancedQuery = enhanceQueryForCategory(query.trim(), filters.category);
    
    console.log('🔍 Enhanced query:', enhancedQuery);
    console.log('🏷️ Category:', filters.category);
    console.log('🚗 Vehicle aspects:', filters.vehicleAspects);
    console.log('🎯 Aspect filter:', aspectFilter);
    console.log('🔧 Filter string:', filterString);
    console.log('🔗 Compatibility filter:', compatibilityFilter);
    
    // Ensure query is properly URL encoded
    searchUrl.searchParams.append('q', enhancedQuery);
    searchUrl.searchParams.append('sort', mode === 'completed' ? 'price_desc' : 'price');
    
    // CRITICAL: Force category filter for motors to ensure we stay in Cars & Trucks
    if (filters.category === 'motors') {
      searchUrl.searchParams.append('category_ids', '6001'); // Cars & Trucks category
      console.log('🚗 FORCED category filter for motors: 6001 (Cars & Trucks)');
      
      // For vehicle searches, add additional filters to ensure we get actual vehicles
      const vehicleFilters = [];
      
      // Add the existing filter string
      if (filterString) {
        vehicleFilters.push(filterString);
      }
      
      // Add vehicle-specific filters to exclude parts/accessories
      vehicleFilters.push('itemLocationCountry:US'); // Focus on US vehicles
      
      // Try to exclude obvious parts categories
      vehicleFilters.push('excludeCategoryIds:{33559,6030,6031,34998}'); // Exclude parts categories
      
      // Combine all filters
      if (vehicleFilters.length > 0) {
        searchUrl.searchParams.set('filter', vehicleFilters.join(','));
      }
      
    } else if (filters.category && filters.category !== 'all') {
      const categoryId = getCategoryId(filters.category);
      if (categoryId) {
        searchUrl.searchParams.append('category_ids', categoryId);
        console.log(`Applied category filter: ${filters.category} -> ${categoryId}`);
      }
      
      if (filterString) {
        searchUrl.searchParams.append('filter', filterString);
      }
    } else {
      if (filterString) {
        searchUrl.searchParams.append('filter', filterString);
      }
    }
    
    if (compatibilityFilter) {
      searchUrl.searchParams.append('compatibility_filter', compatibilityFilter);
    }
    
    // Add aspect filter for vehicle searches - this is KEY for getting actual vehicles
    if (aspectFilter) {
      searchUrl.searchParams.append('aspect_filter', aspectFilter);
      console.log(`🎯 Applied aspect filter: ${aspectFilter}`);
    }
    
    if (filters.postalCode) {
      searchUrl.searchParams.append('buyerPostalCode', filters.postalCode);
    }
    
    // Ensure reasonable limits
    const limit = Math.min(Math.max(pageSize, 1), 200);
    searchUrl.searchParams.append('limit', limit.toString());
    
    if (pageOffset > 0) {
      searchUrl.searchParams.append('offset', pageOffset.toString());
    }

    console.log('🌐 eBay API Request URL:', searchUrl.toString());

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('eBay API Error Response:', errorText);
      throw new Error(`eBay API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ eBay API Response received. Items found:', data.itemSummaries?.length || 0);

    // Process items to include compatibility information and normalize data types
    const processedItems = (data.itemSummaries || []).map((item: any) => ({
      ...item,
      // Ensure price values are numbers, not strings
      price: item.price ? {
        ...item.price,
        value: parseFloat(item.price.value) || 0
      } : undefined,
      
      // Ensure currentBidPrice values are numbers if present
      currentBidPrice: item.currentBidPrice ? {
        ...item.currentBidPrice,
        value: parseFloat(item.currentBidPrice.value) || 0
      } : undefined,
      
      // Ensure shipping cost values are numbers
      shippingOptions: item.shippingOptions ? item.shippingOptions.map((option: any) => ({
        ...option,
        shippingCost: option.shippingCost ? {
          ...option.shippingCost,
          value: parseFloat(option.shippingCost.value) || 0
        } : undefined
      })) : undefined,
      
      // Process compatibility information
      compatibility: item.compatibilityProperties ? {
        compatibilityMatch: item.compatibilityMatch || 'UNKNOWN',
        compatibilityProperties: item.compatibilityProperties || []
      } : undefined
    }));

    console.log(`📊 Processed ${processedItems.length} items for return`);

    return new Response(
      JSON.stringify({ 
        items: processedItems,
        total: data.total || 0,
        href: data.href || '',
        warnings: data.warnings || []
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: any) {
    console.error('Error in eBay search:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});