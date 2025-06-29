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
        scope: 'https://api.ebay.com/oauth/api_scope'
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

function buildFilterString(filters: any, mode = 'live'): string {
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
  
  // Handle buying options based on mode
  if (mode === 'sell' || mode === 'completed') {
    // For sell mode, focus on completed auctions to see what items actually sold for
    filterParts.push('buyingOptions:{AUCTION}');
    // Note: eBay Browse API doesn't have a direct "sold listings" filter
    // The best we can do is filter to auctions which are more likely to be completed sales
  } else if (filters.buyItNowOnly) {
    filterParts.push('buyingOptions:{FIXED_PRICE}');
  } else if (filters.auctionOnly) {
    filterParts.push('buyingOptions:{AUCTION}');
  } else {
    // Include ALL buying options for maximum inventory coverage
    filterParts.push('buyingOptions:{FIXED_PRICE|AUCTION|BEST_OFFER}');
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

// Enhanced query processing for automotive searches with lighter exclusions
function enhanceQueryForCategory(query: string, category: string): string {
  // For motors category, add minimal exclusions to filter out obvious toys/models
  // But keep it light to avoid filtering out legitimate vehicle listings
  if (category === 'motors') {
    const lightExclusions = [
      '-toy', '-toys', '-diecast', '-die-cast', '-matchbox', '-hotwheels', 
      '-hot-wheels', '-miniature', '-scale', '-keychain', '-poster'
    ].join(' ');
    
    // NO positive terms - they filter out too many legitimate listings
    // Just the original query with minimal exclusions
    return `${query} ${lightExclusions}`;
  }
  
  return query;
}

function buildVehicleFilter(vehicleAspects: any, conditionIds: number[] = []): string {
  if (!vehicleAspects) return '';
  
  const filterParts: string[] = [];
  
  // Vehicle aspects must be capitalized exactly as eBay expects:
  // Make:{Dodge}, Model:{Viper}, Year:{1996}
  if (vehicleAspects.make) {
    filterParts.push(`Make:{${vehicleAspects.make}}`);
  }
  
  if (vehicleAspects.model) {
    filterParts.push(`Model:{${vehicleAspects.model}}`);
  }
  
  // eBay returns this aspect as "Model Year", but you can filter by "Year"
  if (vehicleAspects.year) {
    filterParts.push(`Year:{${vehicleAspects.year}}`);
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
        filterParts.push(`Year:{${years.join(',')}}`);
      }
    } else if (vehicleAspects.yearFrom) {
      filterParts.push(`Year:{${vehicleAspects.yearFrom}}`);
    } else if (vehicleAspects.yearTo) {
      filterParts.push(`Year:{${vehicleAspects.yearTo}}`);
    }
  }
  
  // Additional vehicle aspects that could be useful
  if (vehicleAspects.bodyStyle) {
    filterParts.push(`bodyStyle:{${vehicleAspects.bodyStyle}}`);
  }
  
  if (vehicleAspects.driveType) {
    filterParts.push(`driveType:{${vehicleAspects.driveType}}`);
  }
  
  if (vehicleAspects.fuelType) {
    filterParts.push(`fuelType:{${vehicleAspects.fuelType}}`);
  }
  
  if (vehicleAspects.transmission) {
    filterParts.push(`transmission:{${vehicleAspects.transmission}}`);
  }
  
  // Use COMMA separators for Browse API aspect_filter parameter (correct format)
  return filterParts.join(',');
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
  
  const compatibilityProperties: Array<{ name: string; value: any }> = [];
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
      fieldgroups = [],
      sort = 'bestMatch'
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
      filters: { category, conditionIds, freeShipping, buyItNowOnly },
      sort: sort
    });

    // 🔍 DETAILED DEBUGGING FOR VEHICLE DATA EXTRACTION
    console.log('🔍 [DEBUG] Raw body structure:', JSON.stringify(body, null, 2));
    console.log('🔍 [DEBUG] Top-level vehicleAspects:', vehicleData);
    console.log('🔍 [DEBUG] filters.vehicleAspects:', filters.vehicleAspects);
    console.log('🔍 [DEBUG] Final vehicleData:', vehicleData);
    console.log('🔍 [DEBUG] Extracted make:', make);
    console.log('🔍 [DEBUG] Extracted model:', model);
    console.log('🔍 [DEBUG] Extracted year:', year);
    console.log('🔍 [DEBUG] Category:', category);

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
    const isVehicleSearch = category === 'motors' || (getCategoryId(category) === '6001');
    
    if (isVehicleSearch && (!make || !model)) {
      console.log('⚠️ Vehicle search detected but missing required make/model:', { make, model, year });
      // For vehicle searches without make/model, we'll proceed but log a warning
      // This allows for broader vehicle searches like "Ford truck" without strict validation
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
      // Only include vehicle aspects for actual vehicle searches
      vehicleAspects: isVehicleSearch ? vehicleData : undefined
    };

    const filterString = buildFilterString(searchFilters, mode);
    
    // Handle compatibility filter - support both object and string formats
    let compatibilityFilter = '';
    if (filters.compatibilityFilter) {
      if (typeof filters.compatibilityFilter === 'string') {
        // Direct string format (from searchVehicleCompatibleParts)
        compatibilityFilter = filters.compatibilityFilter;
      } else {
        // Object format (from existing compatibility search)
        compatibilityFilter = buildCompatibilityFilter(filters.compatibilityFilter);
      }
    }
    
    // Build vehicle filter only for vehicle searches
    let vehicleFilter = '';
    if (isVehicleSearch && vehicleData && (vehicleData.make || vehicleData.model || vehicleData.year)) {
      console.log('🔍 [DEBUG] Building vehicle filter for vehicle search');
      vehicleFilter = buildVehicleFilter(vehicleData, conditionIds);
      console.log('🔍 [DEBUG] vehicleFilter string:', vehicleFilter);
    } else {
      console.log('🔍 [DEBUG] Skipping vehicle filter - not a vehicle search or no vehicle data');
    }
    
    // Debug logging for vehicle search
    if (isVehicleSearch) {
      console.log('🚗 Vehicle search debug info:');
      console.log('  - Original query:', query);
      console.log('  - Vehicle aspects:', JSON.stringify(vehicleData, null, 2));
      console.log('  - Generated vehicle filter:', vehicleFilter);
      console.log('  - Other filters:', filterString);
      console.log('  - Compatibility filter:', compatibilityFilter);
    } else {
      console.log('🔍 Regular search debug info:');
      console.log('  - Query:', query);
      console.log('  - Category:', category);
      console.log('  - Filters:', filterString);
    }
    
    // Choose endpoint based on mode and environment (sandbox vs production)
    const isSandbox = (Deno.env.get('EBAY_CLIENT_ID') || '').includes('SBX');
    const baseApiUrl = isSandbox 
      ? 'https://api.sandbox.ebay.com/buy/browse/v1/item_summary'
      : 'https://api.ebay.com/buy/browse/v1/item_summary';
      
    // All modes use the same /search endpoint - completed listings are filtered via buyingOptions
    const baseUrl = `${baseApiUrl}/search`;
    
    const searchUrl = new URL(baseUrl);
    
    // Enhance query for specific categories (especially motors to exclude toys/parts)
    const enhancedQuery = enhanceQueryForCategory(query.trim(), category);
    
    // Ensure query is properly URL encoded
    searchUrl.searchParams.append('q', enhancedQuery);
    // Use the sort parameter from frontend request (defaults to bestMatch)
    searchUrl.searchParams.append('sort', sort);
    
    // Add category filter if specified and not "all"
    if (category && category !== 'all') {
      let categoryId: string;
      
      // If it's already a numeric ID (from frontend taxonomy search), use it directly
      if (/^\d+$/.test(category)) {
        categoryId = category;
        console.log(`Using numeric category ID directly: ${categoryId}`);
      } else {
        // Try to map slug to ID, fall back to basic mapping
        const mappedId = getCategoryId(category);
        if (mappedId) {
          categoryId = mappedId;
          console.log(`Mapped category slug: ${category} -> ${categoryId}`);
        } else {
          // Fallback to hardcoded basic mapping for common categories
          const basicMapping: { [key: string]: string } = {
            'electronics': '293',  // Consumer Electronics  
            'fashion': '11450',
            'home': '11700',
            'sporting': '888',
            'toys': '220',
            'business': '12576',
            'jewelry': '281',
            'motors': '6001',
            'collectibles': '1'
          };
          categoryId = basicMapping[category] || category;
          console.log(`Using fallback mapping: ${category} -> ${categoryId}`);
        }
      }
      
      if (categoryId) {
        searchUrl.searchParams.append('category_ids', categoryId);
        console.log(`Applied category filter: ${category} -> ${categoryId}`);
      }
    }
    
    // 1) Static filters go in "filter" parameter
    if (filterString) {
      searchUrl.searchParams.append('filter', filterString);
      console.log(`Applied filter: ${filterString}`);
    }

    // 2) Vehicle aspects (Make/Model/Year) go in "aspect_filter" parameter - ONLY for vehicle searches
    if (isVehicleSearch && vehicleFilter) {
      const aspectFilter = `categoryId:6001,${vehicleFilter}`;
      searchUrl.searchParams.append('aspect_filter', aspectFilter);
      console.log(`Applied aspect_filter: ${aspectFilter}`);
    }
    
    if (compatibilityFilter) {
      searchUrl.searchParams.append('compatibility_filter', compatibilityFilter);
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
    
    // 🔍 DETAILED DEBUGGING: Check actual sort parameter
    console.log('🔍 [DEBUG] Sort parameter received from frontend:', sort);
    console.log('🔍 [DEBUG] Sort parameter in URL:', searchUrl.searchParams.get('sort'));
    console.log('🔍 [DEBUG] All URL parameters:');
    for (const [key, value] of searchUrl.searchParams) {
      console.log(`  ${key}: ${value}`);
    }

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
    
    // 🔍 ZERO RESULTS DEBUGGING
    if (data.total === 0 || !data.itemSummaries || data.itemSummaries.length === 0) {
      console.log('🔍 [ZERO RESULTS DEBUG] Investigating why no results were returned...');
      console.log('  - Original query:', query);
      console.log('  - Enhanced query:', enhancedQuery);
      console.log('  - Category filter:', category);
      console.log('  - Category ID used:', searchUrl.searchParams.get('category_ids'));
      console.log('  - Filter string:', searchUrl.searchParams.get('filter'));
      console.log('  - Sort parameter:', searchUrl.searchParams.get('sort'));
      console.log('  - Complete URL:', searchUrl.toString());
      console.log('  - Response warnings:', data.warnings);
      console.log('  - Response href:', data.href);
      
      // Test without category filter to see if that's the issue
      console.log('🧪 Testing same query WITHOUT category filter...');
      const testUrl = new URL(baseUrl);
      testUrl.searchParams.append('q', query.trim());
      testUrl.searchParams.append('limit', '5');
      if (filterString) {
        testUrl.searchParams.append('filter', filterString);
      }
      
      try {
        const testResponse = await fetch(testUrl.toString(), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
            'Accept': 'application/json',
          },
        });
        
        if (testResponse.ok) {
          const testData = await testResponse.json();
          console.log('🧪 Test without category: Found', testData.total || 0, 'items');
          if (testData.total > 0) {
            console.log('🔍 ISSUE IDENTIFIED: Category filter is causing zero results');
            console.log('  - Category being used:', searchUrl.searchParams.get('category_ids'));
            console.log('  - This category may not contain items matching the query');
          }
        } else {
          console.log('🧪 Test without category also failed:', testResponse.status);
        }
      } catch (testError) {
        console.log('🧪 Test without category error:', testError);
      }
    }
    
    if (data.itemSummaries?.length > 0) {
      console.log('  - First item title:', data.itemSummaries[0]?.title);
      console.log('  - First item price:', data.itemSummaries[0]?.price?.value);
    } else {
      console.log('  - No items found - this could indicate:');
      console.log('    1. No matching items exist on eBay');
      console.log('    2. Category filter is too restrictive');
      console.log('    3. Query enhancement excludes relevant items');
      
      // If we have year filter and no results, try without year as debugging step
      if (filters.vehicleAspects?.year && (filters.vehicleAspects.make || filters.vehicleAspects.model)) {
        console.log('🔍 Debugging: Trying search without year filter...');
        const noYearAspects = { ...filters.vehicleAspects };
        delete noYearAspects.year;
        const fallbackVehicleFilter = buildVehicleFilter(noYearAspects, conditionIds);
        
        const fallbackUrl = new URL(baseUrl);
        fallbackUrl.searchParams.append('q', [filters.vehicleAspects.make, filters.vehicleAspects.model].filter(Boolean).join(' '));
        fallbackUrl.searchParams.append('category_ids', '6001');
        if (fallbackVehicleFilter) {
          fallbackUrl.searchParams.append('filter', fallbackVehicleFilter);
        }
        fallbackUrl.searchParams.append('limit', '5'); // Just a few for testing
        
        console.log('🔍 Fallback URL (no year):', fallbackUrl.toString());
        
        try {
          const fallbackResponse = await fetch(fallbackUrl.toString(), {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
              'Accept': 'application/json',
            },
          });
          
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            console.log('🔍 Fallback results (no year):', fallbackData.total || 0, 'items found');
          }
        } catch (fallbackError) {
          console.log('🔍 Fallback search failed:', fallbackError);
        }
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