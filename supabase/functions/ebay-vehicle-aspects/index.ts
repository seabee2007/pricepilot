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
    console.log('Using OAuth application token');
    return oauthToken;
  }

  // Fallback to client credentials flow
  if (tokenCache && tokenCache.expires_at > Date.now()) {
    return tokenCache.access_token;
  }

  const clientId = Deno.env.get('EBAY_CLIENT_ID');
  const clientSecret = Deno.env.get('EBAY_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Missing eBay API credentials');
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);

  try {
    const oauthUrl = clientId.includes('SBX') 
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token';
      
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
      throw new Error(`eBay OAuth error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    tokenCache = {
      access_token: data.access_token,
      expires_at: Date.now() + (data.expires_in * 1000 * 0.9),
    };

    return data.access_token;
  } catch (error) {
    console.error('Error fetching eBay OAuth token:', error);
    throw error;
  }
}

async function getVehicleAspects(token: string): Promise<any> {
  const isSandbox = (Deno.env.get('EBAY_CLIENT_ID') || '').includes('SBX');
  const baseApiUrl = isSandbox 
    ? 'https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search'
    : 'https://api.ebay.com/buy/browse/v1/item_summary/search';
  
  const url = new URL(baseApiUrl);
  
  // Search in Cars & Trucks category with empty query to get aspect refinements
  url.searchParams.append('q', '');
  url.searchParams.append('category_ids', '6001'); // Cars & Trucks
  url.searchParams.append('fieldgroups', 'ASPECT_REFINEMENTS');
  url.searchParams.append('limit', '1'); // We only need the aspects, not the items

  console.log('Fetching vehicle aspects from:', url.toString());

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('eBay API Error Response:', errorText);
    throw new Error(`eBay API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  console.log('eBay API Response for aspects:', JSON.stringify(data, null, 2));

  // Extract aspect refinements
  const aspectDistributions = data.refinement?.aspectDistributions || [];
  
  const makes: any[] = [];
  const models: any[] = [];
  const years: any[] = [];

  // Process aspect distributions to extract Make, Model, and Year
  aspectDistributions.forEach((aspect: any) => {
    const aspectName = aspect.localizedAspectName?.toLowerCase();
    
    if (aspectName === 'make' || aspectName === 'brand') {
      aspect.aspectValueDistributions?.forEach((value: any) => {
        makes.push({
          value: value.localizedAspectValue,
          displayName: value.localizedAspectValue,
          count: value.matchCount || 0
        });
      });
    } else if (aspectName === 'model') {
      aspect.aspectValueDistributions?.forEach((value: any) => {
        models.push({
          value: value.localizedAspectValue,
          displayName: value.localizedAspectValue,
          count: value.matchCount || 0
        });
      });
    } else if (aspectName === 'year') {
      aspect.aspectValueDistributions?.forEach((value: any) => {
        years.push({
          value: value.localizedAspectValue,
          displayName: value.localizedAspectValue,
          count: value.matchCount || 0
        });
      });
    }
  });

  // Sort arrays by count (descending) and then by name
  const sortAspects = (a: any, b: any) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.displayName.localeCompare(b.displayName);
  };

  makes.sort(sortAspects);
  models.sort(sortAspects);
  
  // For years, sort numerically descending (newest first)
  years.sort((a: any, b: any) => {
    const yearA = parseInt(a.value);
    const yearB = parseInt(b.value);
    if (!isNaN(yearA) && !isNaN(yearB)) {
      return yearB - yearA;
    }
    return b.count - a.count;
  });

  return {
    makes: makes.slice(0, 50), // Limit to top 50 makes
    models: models.slice(0, 100), // Limit to top 100 models
    years: years.slice(0, 50) // Limit to top 50 years
  };
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

    // Verify user authentication
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

    const token = await getOAuthToken();
    const vehicleAspects = await getVehicleAspects(token);

    return new Response(
      JSON.stringify(vehicleAspects),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: any) {
    console.error('Error in vehicle aspects API:', error);
    
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