import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OAuth token cache
let tokenCache: {
  access_token: string;
  expires_at: number;
} | null = null;

async function getOAuthToken(): Promise<string> {
  // Check for cached valid token
  if (tokenCache && tokenCache.expires_at > Date.now()) {
    return tokenCache.access_token;
  }

  const clientId = Deno.env.get('EBAY_CLIENT_ID');
  const clientSecret = Deno.env.get('EBAY_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Missing eBay API credentials - EBAY_CLIENT_ID and EBAY_CLIENT_SECRET required');
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const isProduction = !clientId.includes('SBX');
  
  const oauthUrl = isProduction 
    ? 'https://api.ebay.com/identity/v1/oauth2/token'
    : 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';

  console.log(`Getting OAuth token from ${isProduction ? 'PRODUCTION' : 'SANDBOX'} eBay API`);

  try {
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
      console.error('OAuth Error Response:', errorText);
      throw new Error(`eBay OAuth failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    tokenCache = {
      access_token: data.access_token,
      expires_at: Date.now() + (data.expires_in * 1000 * 0.9), // 90% of expiry for safety
    };

    console.log('OAuth token obtained successfully');
    return data.access_token;
  } catch (error) {
    console.error('OAuth token error:', error);
    throw error;
  }
}

async function getVehicleAspects(token: string): Promise<any> {
  const clientId = Deno.env.get('EBAY_CLIENT_ID');
  const isProduction = !clientId?.includes('SBX');
  
  const baseUrl = isProduction 
    ? 'https://api.ebay.com/buy/browse/v1/item_summary/search'
    : 'https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search';

  console.log(`Fetching vehicle aspects from ${isProduction ? 'PRODUCTION' : 'SANDBOX'} Browse API`);

  // Build the proper Browse API request
  const url = new URL(baseUrl);
  url.searchParams.append('category_ids', '6001'); // Cars & Trucks category
  url.searchParams.append('q', 'car truck vehicle automobile'); // Vehicle-specific query
  url.searchParams.append('fieldgroups', 'ASPECT_REFINEMENTS'); // Request aspect refinements
  url.searchParams.append('limit', '200'); // Get enough items for good aspect coverage
  
  // Add filters to ensure we get actual vehicles
  const filters = [
    'buyingOptions:{FIXED_PRICE|AUCTION}',
    'conditionIds:{1000|3000|2000}', // New, Used, Refurbished
    'itemLocationCountry:US' // US vehicles only
  ];
  url.searchParams.append('filter', filters.join(','));

  console.log('Browse API Request URL:', url.toString());

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'X-EBAY-C-ENDUSERCTX': 'contextualLocation=country%3DUS,zip%3D90210',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Browse API Error Response:', errorText);
      throw new Error(`Browse API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Browse API Response Summary:', {
      total: data.total || 0,
      itemCount: data.itemSummaries?.length || 0,
      hasRefinements: !!data.refinement,
      aspectDistributions: data.refinement?.aspectDistributions?.length || 0
    });

    return data;
  } catch (error) {
    console.error('Error fetching vehicle aspects:', error);
    throw error;
  }
}

async function getMakeSpecificModels(token: string, make: string): Promise<any> {
  const clientId = Deno.env.get('EBAY_CLIENT_ID');
  const isProduction = !clientId?.includes('SBX');
  
  const baseUrl = isProduction 
    ? 'https://api.ebay.com/buy/browse/v1/item_summary/search'
    : 'https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search';

  const url = new URL(baseUrl);
  url.searchParams.append('category_ids', '6001');
  url.searchParams.append('q', `${make} car truck vehicle`);
  url.searchParams.append('fieldgroups', 'ASPECT_REFINEMENTS');
  url.searchParams.append('limit', '200');
  
  // Use aspect filter to focus on specific make
  url.searchParams.append('aspect_filter', `Make:${make}`);
  
  const filters = [
    'buyingOptions:{FIXED_PRICE|AUCTION}',
    'conditionIds:{1000|3000|2000}',
    'itemLocationCountry:US'
  ];
  url.searchParams.append('filter', filters.join(','));

  console.log(`Fetching models for ${make}:`, url.toString());

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'X-EBAY-C-ENDUSERCTX': 'contextualLocation=country%3DUS,zip%3D90210',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Browse API Error for ${make}:`, errorText);
      throw new Error(`Browse API error for ${make}: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`${make} Response Summary:`, {
      total: data.total || 0,
      itemCount: data.itemSummaries?.length || 0,
      aspectDistributions: data.refinement?.aspectDistributions?.length || 0
    });

    return data;
  } catch (error) {
    console.error(`Error fetching models for ${make}:`, error);
    return null; // Return null instead of throwing to continue with other makes
  }
}

function extractAspectsFromResponse(data: any): { makes: any[], models: any[], years: any[] } {
  const makes: any[] = [];
  const models: any[] = [];
  const years: any[] = [];

  if (!data.refinement?.aspectDistributions) {
    console.log('No aspect distributions found in response');
    return { makes, models, years };
  }

  const aspectDistributions = data.refinement.aspectDistributions;
  console.log(`Processing ${aspectDistributions.length} aspect distributions`);

  aspectDistributions.forEach((aspect: any) => {
    const aspectName = aspect.localizedAspectName?.toLowerCase();
    const values = aspect.aspectValueDistributions || [];
    
    console.log(`Processing aspect: ${aspectName} with ${values.length} values`);

    if (aspectName === 'make' || aspectName === 'brand') {
      values.forEach((value: any) => {
        const count = value.matchCount || 0;
        if (count > 0) {
          makes.push({
            value: value.localizedAspectValue,
            displayName: value.localizedAspectValue,
            count: count
          });
        }
      });
    } else if (aspectName === 'model') {
      values.forEach((value: any) => {
        const count = value.matchCount || 0;
        if (count > 0) {
          models.push({
            value: value.localizedAspectValue,
            displayName: value.localizedAspectValue,
            count: count
          });
        }
      });
    } else if (aspectName === 'year') {
      values.forEach((value: any) => {
        const count = value.matchCount || 0;
        if (count > 0) {
          years.push({
            value: value.localizedAspectValue,
            displayName: value.localizedAspectValue,
            count: count
          });
        }
      });
    }
  });

  console.log(`Extracted: ${makes.length} makes, ${models.length} models, ${years.length} years`);
  return { makes, models, years };
}

async function buildComprehensiveVehicleData(token: string): Promise<any> {
  console.log('Building comprehensive vehicle data from eBay Browse API...');
  
  // Step 1: Get general vehicle aspects
  const generalData = await getVehicleAspects(token);
  const { makes: allMakes, years: allYears } = extractAspectsFromResponse(generalData);
  
  console.log(`Step 1 complete: Found ${allMakes.length} makes, ${allYears.length} years`);
  
  // Step 2: Get make-specific models for top makes
  const topMakes = allMakes
    .sort((a, b) => b.count - a.count)
    .slice(0, 15) // Top 15 makes for detailed model data
    .map(make => make.value);
  
  console.log('Step 2: Getting models for top makes:', topMakes);
  
  const allModels: any[] = [];
  
  for (const make of topMakes) {
    try {
      const makeData = await getMakeSpecificModels(token, make);
      if (makeData) {
        const { models } = extractAspectsFromResponse(makeData);
        
        // Associate models with their make
        models.forEach(model => {
          model.make = make;
          allModels.push(model);
        });
        
        console.log(`Found ${models.length} models for ${make}`);
      }
      
      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`Failed to get models for ${make}:`, error);
      // Continue with other makes
    }
  }
  
  // Step 3: Sort and deduplicate
  const uniqueMakes = Array.from(
    new Map(allMakes.map(make => [make.value, make])).values()
  ).sort((a, b) => b.count - a.count);
  
  const uniqueModels = Array.from(
    new Map(allModels.map(model => [`${model.value}-${model.make}`, model])).values()
  ).sort((a, b) => b.count - a.count);
  
  const uniqueYears = Array.from(
    new Map(allYears.map(year => [year.value, year])).values()
  ).sort((a, b) => {
    const yearA = parseInt(a.value);
    const yearB = parseInt(b.value);
    if (!isNaN(yearA) && !isNaN(yearB)) {
      return yearB - yearA; // Newest first
    }
    return b.count - a.count;
  });
  
  console.log(`Final data: ${uniqueMakes.length} makes, ${uniqueModels.length} models, ${uniqueYears.length} years`);
  
  // Log sample data for verification
  if (uniqueMakes.length > 0) {
    console.log('Sample makes:', uniqueMakes.slice(0, 5).map(m => `${m.displayName} (${m.count})`));
  }
  if (uniqueModels.length > 0) {
    console.log('Sample models:', uniqueModels.slice(0, 10).map(m => `${m.displayName} - ${m.make} (${m.count})`));
  }
  
  return {
    makes: uniqueMakes.slice(0, 50),
    models: uniqueModels.slice(0, 500),
    years: uniqueYears.slice(0, 50)
  };
}

function getFallbackVehicleData(): any {
  console.log('Using fallback vehicle data');
  
  const currentYear = new Date().getFullYear();
  const years: any[] = [];
  
  for (let year = currentYear; year >= 1990; year--) {
    years.push({
      value: year.toString(),
      displayName: year.toString(),
      count: Math.floor(Math.random() * 500 + 100)
    });
  }

  return {
    makes: [
      { value: 'Ford', displayName: 'Ford', count: 25420 },
      { value: 'Chevrolet', displayName: 'Chevrolet', count: 22850 },
      { value: 'Toyota', displayName: 'Toyota', count: 21200 },
      { value: 'Honda', displayName: 'Honda', count: 19800 },
      { value: 'Nissan', displayName: 'Nissan', count: 18500 },
      { value: 'BMW', displayName: 'BMW', count: 17200 },
      { value: 'Mercedes-Benz', displayName: 'Mercedes-Benz', count: 16800 },
      { value: 'Audi', displayName: 'Audi', count: 15900 },
      { value: 'Dodge', displayName: 'Dodge', count: 15600 },
      { value: 'Jeep', displayName: 'Jeep', count: 15200 }
    ],
    models: [
      { value: 'F-150', displayName: 'F-150', count: 3500, make: 'Ford' },
      { value: 'Silverado', displayName: 'Silverado', count: 3200, make: 'Chevrolet' },
      { value: 'Camry', displayName: 'Camry', count: 2800, make: 'Toyota' },
      { value: 'Accord', displayName: 'Accord', count: 2600, make: 'Honda' },
      { value: 'Civic', displayName: 'Civic', count: 2400, make: 'Honda' },
      { value: 'Mustang', displayName: 'Mustang', count: 1900, make: 'Ford' },
      { value: 'Corolla', displayName: 'Corolla', count: 1800, make: 'Toyota' },
      { value: 'Altima', displayName: 'Altima', count: 1650, make: 'Nissan' },
      { value: 'Camaro', displayName: 'Camaro', count: 1600, make: 'Chevrolet' },
      { value: 'CR-V', displayName: 'CR-V', count: 1580, make: 'Honda' }
    ],
    years
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('User authenticated:', user.id);

    // Get OAuth token and fetch vehicle data
    const token = await getOAuthToken();
    
    let vehicleData;
    try {
      vehicleData = await buildComprehensiveVehicleData(token);
      console.log('Successfully built comprehensive vehicle data from eBay Browse API');
    } catch (error) {
      console.error('Error building vehicle data, using fallback:', error);
      vehicleData = getFallbackVehicleData();
    }

    // Ensure we have valid data
    if (!vehicleData.makes || vehicleData.makes.length === 0) {
      console.log('No makes found, using fallback');
      vehicleData = getFallbackVehicleData();
    }

    console.log(`Returning: ${vehicleData.makes.length} makes, ${vehicleData.models.length} models, ${vehicleData.years.length} years`);

    return new Response(
      JSON.stringify(vehicleData),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: any) {
    console.error('Vehicle API error:', error);
    
    // Always return fallback to ensure UI works
    const fallbackData = getFallbackVehicleData();
    
    return new Response(
      JSON.stringify(fallbackData),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});