import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

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

interface CompatibilityProperty {
  name: string;
  localizedName: string;
}

interface CompatibilityPropertyValue {
  value: string;
}

interface VehicleAspect {
  value: string;
  displayName: string;
  count: number;
  make?: string;
}

interface VehicleAspects {
  makes: VehicleAspect[];
  models: VehicleAspect[];
  years: VehicleAspect[];
  compatibilityProperties: CompatibilityProperty[];
}

// Get compatibility properties for a category
export async function getCompatibilityProperties(categoryId: string = '33559'): Promise<CompatibilityProperty[]> {
  const isSandbox = (Deno.env.get('EBAY_CLIENT_ID') || '').includes('SBX');
  const categoryTreeId = isSandbox ? '100' : '100'; // eBay Motors US for both
  
  const baseApiUrl = isSandbox 
    ? 'https://api.sandbox.ebay.com/commerce/taxonomy/v1'
    : 'https://api.ebay.com/commerce/taxonomy/v1';
  
  const url = `${baseApiUrl}/category_tree/${categoryTreeId}/get_compatibility_properties?category_id=${categoryId}`;
  
  console.log('Getting compatibility properties from:', url);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${await getOAuthToken()}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Taxonomy API Error Response:', errorText);
    throw new Error(`Taxonomy API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.compatibilityProperties || [];
}

// Get compatibility property values with optional filters
async function getCompatibilityPropertyValues(
  token: string, 
  categoryId: string, 
  compatibilityProperty: string,
  filters?: string
): Promise<CompatibilityPropertyValue[]> {
  const isSandbox = (Deno.env.get('EBAY_CLIENT_ID') || '').includes('SBX');
  const categoryTreeId = isSandbox ? '100' : '100'; // eBay Motors US for both
  
  const baseApiUrl = isSandbox 
    ? 'https://api.sandbox.ebay.com/commerce/taxonomy/v1'
    : 'https://api.ebay.com/commerce/taxonomy/v1';
  
  const url = new URL(`${baseApiUrl}/category_tree/${categoryTreeId}/get_compatibility_property_values`);
  url.searchParams.append('category_id', categoryId);
  url.searchParams.append('compatibility_property', compatibilityProperty);
  
  if (filters) {
    url.searchParams.append('filter', filters);
  }
  
  console.log(`Getting ${compatibilityProperty} values from:`, url.toString());

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Taxonomy API Error Response:', errorText);
    throw new Error(`Taxonomy API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.compatibilityPropertyValues || [];
}

async function getVehicleAspectsFromTaxonomy(token: string): Promise<VehicleAspects> {
  console.log('Starting Taxonomy API vehicle aspects collection...');
  
  // Use Car & Truck Parts & Accessories category (33559) for vehicle compatibility
  // This is the parts category that should support compatibility properties (not the vehicle category 6001)
  const categoryId = '33559'; // Car & Truck Parts & Accessories - supports parts compatibility
  
  try {
    // First, get the compatibility properties for this category
    console.log('Getting compatibility properties for Car & Truck Parts & Accessories category (33559)...');
    const compatibilityProperties = await getCompatibilityProperties(categoryId);
    console.log('Found compatibility properties:', compatibilityProperties.map(p => p.name));
    
    const results: VehicleAspects = {
      makes: [],
      models: [],
      years: [],
      compatibilityProperties
    };
    
    // Get all years (no filters needed)
    if (compatibilityProperties.some(p => p.name === 'Year')) {
      console.log('Getting years...');
      const yearValues = await getCompatibilityPropertyValues(token, categoryId, 'Year');
      results.years = yearValues
        .map(v => ({
          value: v.value,
          displayName: v.value,
          count: 100 // Taxonomy API doesn't provide counts
        }))
        .sort((a, b) => parseInt(b.value) - parseInt(a.value)); // Most recent first
      console.log(`Found ${results.years.length} years`);
    }
    
    // Get all makes (no filters needed)
    if (compatibilityProperties.some(p => p.name === 'Make')) {
      console.log('Getting makes...');
      const makeValues = await getCompatibilityPropertyValues(token, categoryId, 'Make');
      results.makes = makeValues
        .map(v => ({
          value: v.value,
          displayName: v.value,
          count: 100 // Taxonomy API doesn't provide counts
        }))
        .sort((a, b) => a.value.localeCompare(b.value)); // Alphabetical order
      console.log(`Found ${results.makes.length} makes`);
    }
    
    // Get models for top makes to provide some initial data
    if (compatibilityProperties.some(p => p.name === 'Model') && results.makes.length > 0) {
      console.log('Getting models for top makes...');
      const topMakes = results.makes.slice(0, 5); // Get models for first 5 makes to avoid rate limits
      
      for (const make of topMakes) {
        try {
          console.log(`Getting models for ${make.value}...`);
          const modelValues = await getCompatibilityPropertyValues(
            token, 
            categoryId, 
            'Model',
            `Make:${make.value}`
          );
          
          const makeModels = modelValues.map(v => ({
            value: v.value,
            displayName: v.value,
            count: 100,
            make: make.value
          }));
          
          results.models.push(...makeModels);
          console.log(`Found ${makeModels.length} models for ${make.value}`);
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Error getting models for ${make.value}:`, error);
          // Continue with other makes
        }
      }
      
      console.log(`Total models collected: ${results.models.length}`);
    }
    
    return results;
    
  } catch (error) {
    console.error('Error in Taxonomy API:', error);
    // If the parts category also fails, fall back to fallback data
    console.log('Taxonomy API failed completely, using fallback data');
    throw error;
  }
}

function getFallbackVehicleAspects(): VehicleAspects {
  const currentYear = new Date().getFullYear();
  const years: VehicleAspect[] = [];
  
  // Generate years from current year back to 1990
  for (let year = currentYear; year >= 1990; year--) {
    years.push({
      value: year.toString(),
      displayName: year.toString(),
      count: 100
    });
  }

  return {
    compatibilityProperties: [
      { name: 'Year', localizedName: 'Year' },
      { name: 'Make', localizedName: 'Make' },
      { name: 'Model', localizedName: 'Model' },
      { name: 'Trim', localizedName: 'Trim' },
      { name: 'Engine', localizedName: 'Engine' }
    ],
    makes: [
      { value: 'Ford', displayName: 'Ford', count: 15420 },
      { value: 'Chevrolet', displayName: 'Chevrolet', count: 12850 },
      { value: 'Toyota', displayName: 'Toyota', count: 11200 },
      { value: 'Honda', displayName: 'Honda', count: 9800 },
      { value: 'Nissan', displayName: 'Nissan', count: 8500 },
      { value: 'BMW', displayName: 'BMW', count: 7200 },
      { value: 'Mercedes-Benz', displayName: 'Mercedes-Benz', count: 6800 },
      { value: 'Audi', displayName: 'Audi', count: 5900 },
      { value: 'Dodge', displayName: 'Dodge', count: 5600 },
      { value: 'Jeep', displayName: 'Jeep', count: 5200 },
      { value: 'GMC', displayName: 'GMC', count: 4800 },
      { value: 'Hyundai', displayName: 'Hyundai', count: 4500 },
      { value: 'Kia', displayName: 'Kia', count: 4200 },
      { value: 'Subaru', displayName: 'Subaru', count: 3900 },
      { value: 'Mazda', displayName: 'Mazda', count: 3600 },
      { value: 'Volkswagen', displayName: 'Volkswagen', count: 3400 },
      { value: 'Lexus', displayName: 'Lexus', count: 3200 },
      { value: 'Cadillac', displayName: 'Cadillac', count: 2800 },
      { value: 'Buick', displayName: 'Buick', count: 2500 },
      { value: 'Lincoln', displayName: 'Lincoln', count: 2200 }
    ],
    models: [
      { value: 'F-150', displayName: 'F-150', count: 2500, make: 'Ford' },
      { value: 'Mustang', displayName: 'Mustang', count: 900, make: 'Ford' },
      { value: 'Camry', displayName: 'Camry', count: 1200, make: 'Toyota' },
      { value: 'Civic', displayName: 'Civic', count: 1100, make: 'Honda' },
      { value: 'Silverado', displayName: 'Silverado', count: 1800, make: 'Chevrolet' }
    ],
    years
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting eBay Taxonomy API vehicle aspects request');
    
    const token = await getOAuthToken();
    console.log('OAuth token obtained successfully');
    
    const requestBody = await req.json();
    const { action, categoryId, compatibilityProperty, filters } = requestBody;
    
    // Handle different actions
    if (action === 'getProperties') {
      // Get compatibility properties for a category
      const properties = await getCompatibilityProperties(categoryId || '33559');
      return new Response(
        JSON.stringify({ compatibilityProperties: properties }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (action === 'getPropertyValues') {
      // Get values for a specific property
      const values = await getCompatibilityPropertyValues(token, categoryId || '33559', compatibilityProperty, filters);
      return new Response(
        JSON.stringify({ values: values.map(v => ({ ...v, count: 100 })) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Default action: get all vehicle aspects
    try {
      const vehicleAspects = await getVehicleAspectsFromTaxonomy(token);
      
      console.log('Successfully collected vehicle aspects:', {
        makes: vehicleAspects.makes.length,
        models: vehicleAspects.models.length,
        years: vehicleAspects.years.length,
        properties: vehicleAspects.compatibilityProperties.length
      });
      
      return new Response(
        JSON.stringify(vehicleAspects),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } catch (taxonomyError) {
      console.error('Taxonomy API failed, using fallback data:', taxonomyError);
      
      const fallbackData = getFallbackVehicleAspects();
      return new Response(
        JSON.stringify(fallbackData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
  } catch (error: any) {
    console.error('Error in vehicle aspects function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        fallback: getFallbackVehicleAspects()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});