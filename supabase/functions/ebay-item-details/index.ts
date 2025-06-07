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

    // Require user authentication
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

    const { itemId, fieldgroups = ['PRODUCT', 'ADDITIONAL_SELLER_DETAILS'] } = body;

    // Validate required fields
    if (!itemId || itemId.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: itemId' }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    console.log('📨 Getting item details for:', itemId);
    console.log('📨 Requested fieldgroups:', fieldgroups);

    // Get eBay token
    const token = await getApplicationToken();
    
    // Choose endpoint based on environment (sandbox vs production)
    const isSandbox = (Deno.env.get('EBAY_CLIENT_ID') || '').includes('SBX');
    const baseApiUrl = isSandbox 
      ? 'https://api.sandbox.ebay.com/buy/browse/v1/item'
      : 'https://api.ebay.com/buy/browse/v1/item';
      
    const itemUrl = new URL(`${baseApiUrl}/${encodeURIComponent(itemId)}`);
    
    // Add fieldgroups parameter if specified
    if (fieldgroups && fieldgroups.length > 0) {
      itemUrl.searchParams.append('fieldgroups', fieldgroups.join(','));
    }

    console.log('eBay Item Details API Request URL:', itemUrl.toString());

    const response = await fetch(itemUrl.toString(), {
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
      console.error('❌ Failed URL:', itemUrl.toString());
      throw new Error(`eBay API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ eBay Item Details Response Summary:');
    console.log('  - Item ID:', data.itemId);
    console.log('  - Title:', data.title);
    console.log('  - Price:', data.price?.value, data.price?.currency);
    console.log('  - Condition:', data.condition);
    console.log('  - Product available:', !!data.product);
    console.log('  - Seller details available:', !!data.seller);

    // Process the item data to ensure price values are numbers
    const processedItem = {
      ...data,
      // Ensure price values are numbers, not strings
      price: data.price ? {
        ...data.price,
        value: parseFloat(data.price.value) || 0
      } : undefined,
      
      // Ensure currentBidPrice values are numbers if present
      currentBidPrice: data.currentBidPrice ? {
        ...data.currentBidPrice,
        value: parseFloat(data.currentBidPrice.value) || 0
      } : undefined,
      
      // Ensure shipping cost values are numbers
      shippingOptions: data.shippingOptions ? data.shippingOptions.map((option: any) => ({
        ...option,
        shippingCost: option.shippingCost ? {
          ...option.shippingCost,
          value: parseFloat(option.shippingCost.value) || 0
        } : undefined
      })) : undefined,
    };

    return new Response(
      JSON.stringify(processedItem),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: any) {
    console.error('Error in eBay item details:', error);
    
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