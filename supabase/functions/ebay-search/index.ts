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
  // If token exists and is still valid, return it
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
  
  // Buy It Now filter is already correct
  if (filters.buyItNowOnly) {
    filterParts.push('buyingOptions:{FIXED_PRICE}');
  }

  return filterParts.join(',');
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

    const { query, filters = {}, pageSize = 50, pageOffset = 0, mode = 'live' } = await req.json();

    if (!query) {
      throw new Error('Search query is required');
    }

    const token = await getOAuthToken();
    const filterString = buildFilterString(filters);
    
    // Choose endpoint based on mode
    const baseUrl = mode === 'completed' 
      ? 'https://api.ebay.com/buy/browse/v1/item_summary/completed'
      : 'https://api.ebay.com/buy/browse/v1/item_summary/search';
    
    const url = new URL(baseUrl);
    url.searchParams.append('q', query);
    url.searchParams.append('sort', mode === 'completed' ? 'price_desc' : 'price');
    
    if (filterString) {
      url.searchParams.append('filter', filterString);
    }
    
    if (filters.postalCode) {
      url.searchParams.append('buyerPostalCode', filters.postalCode);
    }
    
    url.searchParams.append('limit', pageSize.toString());
    
    if (pageOffset > 0) {
      url.searchParams.append('offset', pageOffset.toString());
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`eBay API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({ 
        items: data.itemSummaries || [],
        total: data.total || 0,
        href: data.href || ''
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