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

    // Cache it with expiration
    cachedToken = access_token;
    tokenExpiresAt = now + (expires_in * 1000);

    return access_token;
  } catch (error) {
    console.error('❌ Error fetching eBay token:', error);
    throw error;
  }
}

async function getDealItems(filters: any, token: string): Promise<any> {
  const isSandbox = (Deno.env.get('EBAY_CLIENT_ID') || '').includes('SBX');
  const baseApiUrl = isSandbox 
    ? 'https://api.sandbox.ebay.com/buy/deal/v1/deal_item'
    : 'https://api.ebay.com/buy/deal/v1/deal_item';
  
  const url = new URL(baseApiUrl);
  
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    url.searchParams.append('category_ids', filters.categoryIds.join(','));
  }
  
  if (filters.limit) {
    url.searchParams.append('limit', filters.limit.toString());
  }
  
  if (filters.offset) {
    url.searchParams.append('offset', filters.offset.toString());
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
    throw new Error(`eBay Deal API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

async function getEvents(filters: any, token: string): Promise<any> {
  const isSandbox = (Deno.env.get('EBAY_CLIENT_ID') || '').includes('SBX');
  const baseApiUrl = isSandbox 
    ? 'https://api.sandbox.ebay.com/buy/deal/v1/event'
    : 'https://api.ebay.com/buy/deal/v1/event';
  
  const url = new URL(baseApiUrl);
  
  if (filters.limit) {
    url.searchParams.append('limit', filters.limit.toString());
  }
  
  if (filters.offset) {
    url.searchParams.append('offset', filters.offset.toString());
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
    throw new Error(`eBay Deal API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

async function getEvent(eventId: string, token: string): Promise<any> {
  const isSandbox = (Deno.env.get('EBAY_CLIENT_ID') || '').includes('SBX');
  const baseApiUrl = isSandbox 
    ? 'https://api.sandbox.ebay.com/buy/deal/v1/event'
    : 'https://api.ebay.com/buy/deal/v1/event';
  
  const url = `${baseApiUrl}/${eventId}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eBay Deal API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

async function getEventItems(filters: any, token: string): Promise<any> {
  const isSandbox = (Deno.env.get('EBAY_CLIENT_ID') || '').includes('SBX');
  const baseApiUrl = isSandbox 
    ? 'https://api.sandbox.ebay.com/buy/deal/v1/event_item'
    : 'https://api.ebay.com/buy/deal/v1/event_item';
  
  const url = new URL(baseApiUrl);
  
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    url.searchParams.append('category_ids', filters.categoryIds.join(','));
  }
  
  if (filters.eventIds && filters.eventIds.length > 0) {
    url.searchParams.append('event_ids', filters.eventIds.join(','));
  }
  
  if (filters.limit) {
    url.searchParams.append('limit', filters.limit.toString());
  }
  
  if (filters.offset) {
    url.searchParams.append('offset', filters.offset.toString());
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
    throw new Error(`eBay Deal API error: ${response.status} ${response.statusText} - ${errorText}`);
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

    const url = new URL(req.url);
    const pathname = url.pathname;
    const token = await getApplicationToken();

    // Route based on endpoint
    if (pathname.includes('/deal_items')) {
      const { filters = {} } = await req.json();
      const result = await getDealItems(filters, token);
      
      return new Response(
        JSON.stringify(result),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    } 
    else if (pathname.includes('/events') && pathname.split('/').length > 3) {
      // Single event: /events/{eventId}
      const eventId = pathname.split('/').pop();
      if (!eventId) {
        throw new Error('Event ID is required');
      }
      
      const result = await getEvent(eventId, token);
      
      return new Response(
        JSON.stringify(result),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    } 
    else if (pathname.includes('/events')) {
      // All events: /events
      const { filters = {} } = await req.json();
      const result = await getEvents(filters, token);
      
      return new Response(
        JSON.stringify(result),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    } 
    else if (pathname.includes('/event_items')) {
      const { filters = {} } = await req.json();
      const result = await getEventItems(filters, token);
      
      return new Response(
        JSON.stringify(result),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    } 
    else {
      throw new Error('Invalid endpoint');
    }

  } catch (error: any) {
    console.error('Error in eBay deals API:', error);
    
    // Check if it's an access restriction error
    if (error.message.includes('403') || error.message.includes('Forbidden')) {
      return new Response(
        JSON.stringify({ 
          error: 'Deal API access restricted',
          message: 'This is a Limited Release API requiring special approval from eBay',
          documentation: 'https://developer.ebay.com/api-docs/buy/deal/overview.html'
        }),
        { 
          status: 403, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }
    
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