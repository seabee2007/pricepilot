import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Bulletproof token caching with auto-refresh
let cachedToken = null;
let tokenExpiresAt = 0;

async function getApplicationToken(): Promise<string> {
  const now = Date.now();

  // If we still have a valid token (with a minute buffer), reuse it
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    console.log('✅ Using cached eBay token');
    return cachedToken;
  }

  console.log('🔄 Fetching fresh eBay token...');

  const clientId = Deno.env.get('EBAY_CLIENT_ID');
  const clientSecret = Deno.env.get('EBAY_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Missing eBay API credentials (EBAY_CLIENT_ID and EBAY_CLIENT_SECRET required)');
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const isProduction = !clientId.includes('SBX');
  
  const oauthUrl = isProduction 
    ? 'https://api.ebay.com/identity/v1/oauth2/token'
    : 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';

  try {
    const response = await fetch(oauthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope/buy.browse'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ eBay OAuth Error:', errorText);
      throw new Error(`Failed to fetch eBay token: ${response.status} ${errorText}`);
    }

    const { access_token, expires_in } = await response.json();
    
    console.log('✅ Fresh eBay token obtained');
    console.log(`  - Environment: ${isProduction ? 'PRODUCTION' : 'SANDBOX'}`);
    console.log(`  - Expires in: ${expires_in} seconds`);
    console.log(`  - Token prefix: ${access_token?.substring(0, 20)}...`);

    // Cache it with expiration
    cachedToken = access_token;
    tokenExpiresAt = now + (expires_in * 1000);

    return access_token;
  } catch (error) {
    console.error('❌ Error fetching eBay token:', error);
    throw error;
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

// Enhanced query processing for automotive searches with stronger exclusions
function enhanceQueryForCategory(query: string, category: string): string {
  // For motors category, add strong exclusions to filter out toys, models, and parts
  if (category === 'motors') {
    const exclusions = [
      '-toy', '-toys', '-model', '-models', '-diecast', '-die-cast',
      '-matchbox', '-hotwheels', '-hot-wheels', '-miniature', '-scale',
      '-parts', '-part', '-accessory', '-accessories', '-component',
      '-keychain', '-poster', '-manual', '-book', '-shirt', '-decal', 
      '-sticker', '-emblem', '-badge', '-collectible', '-memorabilia',
      '-remote', '-control', '-rc', '-plastic', '-metal', '-replica',
      '-figurine', '-action', '-figure'
    ].join(' ');
    
    // Add positive terms to reinforce we want actual vehicles
    const positiveTerms = 'automobile motor vehicle transportation';
    
    return `${query} ${positiveTerms} ${exclusions}`;
  }
  
  return query;
}

function buildAspectFilter(vehicleAspects: any, conditionIds: number[] = []): string {
  if (!vehicleAspects) return '';
  
  const aspectParts: string[] = []; // Remove categoryId since we use category_ids parameter
  
  // Add condition distributions in Sample 6 format if specified
  if (conditionIds && conditionIds.length > 0) {
    const conditionNames = conditionIds.map(id => {
      switch(id) {
        case 1000: return 'NEW';
        case 2000: return 'CERTIFIED_REFURBISHED';
        case 3000: return 'USED';
        case 4000: return 'VERY_GOOD';
        case 5000: return 'GOOD';
        case 6000: return 'ACCEPTABLE';
        default: return 'USED';
      }
    });
    aspectParts.push(`conditionDistributions:{${conditionNames.join('|')}}`);
  }
  
  // Build aspect filters for vehicle search using PIPE separators (correct vehicle format)
  if (vehicleAspects.make) {
    aspectParts.push(`Make:{${vehicleAspects.make}}`);
  }
  
  if (vehicleAspects.model) {
    aspectParts.push(`Model:{${vehicleAspects.model}}`);
  }
  
  if (vehicleAspects.year) {
    aspectParts.push(`Year:{${vehicleAspects.year}}`);
  } else if (vehicleAspects.yearFrom || vehicleAspects.yearTo) {
    // Handle year range - create multiple year values
    if (vehicleAspects.yearFrom && vehicleAspects.yearTo) {
      const fromYear = parseInt(vehicleAspects.yearFrom);
      const toYear = parseInt(vehicleAspects.yearTo);
      const years: string[] = [];
      for (let year = fromYear; year <= toYear; year++) {
        years.push(year.toString());
      }
      if (years.length > 0) {
        aspectParts.push(`Year:{${years.join('|')}}`);
      }
    } else if (vehicleAspects.yearFrom) {
      aspectParts.push(`Year:{${vehicleAspects.yearFrom}}`);
    } else if (vehicleAspects.yearTo) {
      aspectParts.push(`Year:{${vehicleAspects.yearTo}}`);
    }
  }
  
  // Additional vehicle aspects that could be useful
  if (vehicleAspects.bodyStyle) {
    aspectParts.push(`Body Style:{${vehicleAspects.bodyStyle}}`);
  }
  
  if (vehicleAspects.driveType) {
    aspectParts.push(`Drive Type:{${vehicleAspects.driveType}}`);
  }
  
  if (vehicleAspects.fuelType) {
    aspectParts.push(`Fuel Type:{${vehicleAspects.fuelType}}`);
  }
  
  if (vehicleAspects.transmission) {
    aspectParts.push(`Transmission:{${vehicleAspects.transmission}}`);
  }
  
  // Use PIPE separators for vehicle aspects (correct format)
  return aspectParts.join('|');
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
  
  const compatibilityProperties: { name: string; value: string }[] = [];
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

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed, use POST' }),
      { 
        status: 405, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
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

    // Parse JSON body
    let body;
    try {
      body = await req.json();
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Destructure exactly what the frontend sends
    const {
      query,
      mode = 'live',
      pageSize = 50,
      pageOffset = 0,
      filters = {},
      fieldgroups = []
    } = body;

    // Extract nested vehicle aspects from filters
    const vehicleData = filters.vehicleAspects || {};
    const { make, model, year, yearFrom, yearTo } = vehicleData;

    // Extract other filters
    const {
      category,
      conditionIds = [],
      freeShipping = false,
      buyItNowOnly = false,
      sellerLocation,
      priceRange,
      returnsAccepted,
      postalCode
    } = filters;

    console.log('📨 Parsed request data:', {
      query,
      mode,
      pageSize,
      pageOffset,
      vehicleAspects: vehicleData,
      filters: { category, conditionIds, freeShipping, buyItNowOnly }
    });

    // Validate required fields
    if (!query || query.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: query' }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // For vehicle searches, validate that we have proper vehicle aspects
    if (category === 'motors' && (!make || !model)) {
      return new Response(
        JSON.stringify({ 
          error: 'Vehicle searches require make and model', 
          details: 'Please select a make and model for vehicle searches' 
        }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    const url = new URL(req.url);
    const pathname = url.pathname;

    // Handle compatibility check endpoint
    if (pathname.includes('/check_compatibility')) {
      const { itemId, compatibility } = body;
      
      if (!itemId || !compatibility) {
        throw new Error('Item ID and compatibility parameters are required');
      }

      const token = await getApplicationToken();
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

    // Get token and build search
    const token = await getApplicationToken();
    
    // Build filters object for existing functions
    const searchFilters = {
      category,
      conditionIds,
      freeShipping,
      buyItNowOnly,
      sellerLocation,
      priceRange,
      returnsAccepted,
      postalCode,
      vehicleAspects: vehicleData
    };

    const filterString = buildFilterString(searchFilters);
    
    // Handle compatibility filter - support both object and string formats
    let compatibilityFilter = '';
    if (filters.compatibilityFilter) {
      if (typeof filters.compatibilityFilter === 'string') {
        // Direct string format
        compatibilityFilter = filters.compatibilityFilter;
      } else {
        // Object format (from existing compatibility search)
        compatibilityFilter = buildCompatibilityFilter(filters.compatibilityFilter);
      }
    }
    
    const aspectFilter = buildAspectFilter(vehicleData, conditionIds);
    
    // Choose endpoint based on mode and environment (sandbox vs production)
    const isSandbox = (Deno.env.get('EBAY_CLIENT_ID') || '').includes('SBX');
    const baseApiUrl = isSandbox 
      ? 'https://api.sandbox.ebay.com/buy/browse/v1/item_summary'
      : 'https://api.ebay.com/buy/browse/v1/item_summary';
      
    const baseUrl = mode === 'completed' 
      ? `${baseApiUrl}/completed`
      : `${baseApiUrl}/search`;
    
    const searchUrl = new URL(baseUrl);
    
    // Enhance query for specific categories (especially motors to exclude toys/parts)
    const enhancedQuery = enhanceQueryForCategory(query.trim(), category);
    
    // Ensure query is properly URL encoded
    searchUrl.searchParams.append('q', enhancedQuery);
    searchUrl.searchParams.append('sort', mode === 'completed' ? 'price_desc' : 'price');
    
    // Add category filter if specified and not "all" - ALWAYS add for motors
    if (category === 'motors' || (category && category !== 'all')) {
      const categoryId = getCategoryId(category) || category || '6001'; // Use direct ID if not found in map, default to Cars & Trucks
      searchUrl.searchParams.append('category_ids', categoryId);
      console.log(`Applied category filter: ${category} -> ${categoryId}`);
    }
    
    if (filterString) {
      searchUrl.searchParams.append('filter', filterString);
    }
    
    if (compatibilityFilter) {
      searchUrl.searchParams.append('compatibility_filter', compatibilityFilter);
    }
    
    // Add aspect filter for vehicle searches
    if (aspectFilter) {
      // URL encode the aspect filter as required by eBay API
      const encodedAspectFilter = encodeURIComponent(aspectFilter);
      searchUrl.searchParams.append('aspect_filter', encodedAspectFilter);
      console.log(`Applied aspect filter: ${aspectFilter}`);
      console.log(`URL encoded aspect filter: ${encodedAspectFilter}`);
    }
    
    // Add fieldgroups for extended data (Sample 6 format)
    if (fieldgroups && fieldgroups.length > 0) {
      searchUrl.searchParams.append('fieldgroups', fieldgroups.join(','));
      console.log(`Applied fieldgroups: ${fieldgroups.join(',')}`);
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

    console.log('eBay API Request URL:', searchUrl.toString());

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Accept': 'application/json',
      },
    });

    console.log('📡 eBay API Response Status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ eBay API Error Response:', errorText);
      console.error('❌ Failed URL:', searchUrl.toString());
      throw new Error(`eBay API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ eBay API Response Summary:');
    console.log('  - Total items found:', data.total || 0);
    console.log('  - Items returned:', data.itemSummaries?.length || 0);
    console.log('  - Warnings:', data.warnings?.length || 0);
    
    if (data.itemSummaries?.length > 0) {
      console.log('  - First item title:', data.itemSummaries[0]?.title);
      console.log('  - First item price:', data.itemSummaries[0]?.price?.value);
    } else {
      console.log('  - No items found for vehicle search criteria');
      
      // If we have vehicle filters, try a simpler search for debugging
      if (vehicleData?.make || vehicleData?.model) {
        console.log('🔍 Vehicle search returned no results - this could indicate restrictive filters');
      }
    }

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