import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Reuse token logic from ebay-search
let cachedToken = null;
let tokenExpiresAt = 0;

async function getApplicationToken(): Promise<string> {
  const now = Date.now();

  if (cachedToken && now < tokenExpiresAt - 60_000) {
    console.log('✅ Using cached eBay token');
    return cachedToken;
  }

  console.log('🔄 Fetching fresh eBay token...');

  const clientId = Deno.env.get('EBAY_CLIENT_ID');
  const clientSecret = Deno.env.get('EBAY_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Missing eBay API credentials');
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const isProduction = !clientId.includes('SBX');
  
  const oauthUrl = isProduction 
    ? 'https://api.ebay.com/identity/v1/oauth2/token'
    : 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';

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
    throw new Error(`Failed to fetch eBay token: ${response.status} ${errorText}`);
  }

  const { access_token, expires_in } = await response.json();
  
  cachedToken = access_token;
  tokenExpiresAt = now + (expires_in * 1000);

  return access_token;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow GET requests for aspects
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed, use GET for aspects' }),
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
    const url = new URL(req.url);
    const make = url.searchParams.get('make');
    const model = url.searchParams.get('model');
    
    console.log('🔍 Getting vehicle aspects for:', { make, model });

    // Build eBay Browse API URL with query parameters only
    const isSandbox = (Deno.env.get('EBAY_CLIENT_ID') || '').includes('SBX');
    const baseApiUrl = isSandbox 
      ? 'https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search'
      : 'https://api.ebay.com/buy/browse/v1/item_summary/search';
    
    const ebayUrl = new URL(baseApiUrl);
    
    // Required parameters for getting aspect refinements
    ebayUrl.searchParams.append('category_ids', '6001'); // Cars & Trucks
    ebayUrl.searchParams.append('fieldgroups', 'ASPECT_REFINEMENTS');
    
    // If make/model specified, add aspect_filter to narrow results
    if (make || model) {
      const filterParts: string[] = ['categoryId:6001']; // Include categoryId in aspect_filter
      if (make) filterParts.push(`Make:{${make}}`);
      if (model) filterParts.push(`Model:{${model}}`);
      
      if (filterParts.length > 1) {
        ebayUrl.searchParams.append('aspect_filter', filterParts.join(','));
      }
    }

    console.log('🌐 eBay aspects request URL:', ebayUrl.toString());

    const token = await getApplicationToken();
    
    const response = await fetch(ebayUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ eBay API Error:', errorText);
      throw new Error(`eBay API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ eBay aspects response received');
    console.log('  - Aspect distributions found:', data.aspectDistributions?.length || 0);
    
    // Log the aspect distributions structure for debugging
    if (data.aspectDistributions) {
      data.aspectDistributions.forEach((dist: any) => {
        console.log(`  - ${dist.refinementLabel || dist.localizedAspectName}: ${dist.values?.length || dist.aspectValueDistributions?.length || 0} values`);
      });
    }

    return new Response(
      JSON.stringify(data),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: any) {
    console.error('Error in vehicle aspects:', error);
    
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