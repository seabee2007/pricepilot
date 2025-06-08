import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Cache for taxonomy data (24 hour TTL)
interface TaxonomyCache {
  data: any;
  lastUpdated: number;
  version: string;
}

let taxonomyCache: TaxonomyCache | null = null;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get eBay OAuth token using client credentials
 */
async function getEbayOAuthToken(): Promise<string> {
  const clientId = Deno.env.get('EBAY_CLIENT_ID');
  const clientSecret = Deno.env.get('EBAY_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    throw new Error('Missing eBay API credentials in environment variables');
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const isProduction = !clientId.includes('SBX');
  
  const oauthUrl = isProduction 
    ? 'https://api.ebay.com/identity/v1/oauth2/token'
    : 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';

  console.log(`🔑 Fetching eBay OAuth token (${isProduction ? 'production' : 'sandbox'})`);

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
    console.error('❌ OAuth token error:', errorText);
    throw new Error(`Failed to fetch eBay OAuth token: ${response.status}`);
  }

  const { access_token } = await response.json();
  console.log('✅ eBay OAuth token obtained');
  return access_token;
}

/**
 * Fetch eBay taxonomy from Commerce API
 */
async function fetchEbayTaxonomy(): Promise<any> {
  console.log('🌳 Fetching eBay taxonomy from Commerce API...');
  
  const token = await getEbayOAuthToken();
  const clientId = Deno.env.get('EBAY_CLIENT_ID');
  const isProduction = clientId && !clientId.includes('SBX');
  
  const apiUrl = isProduction 
    ? 'https://api.ebay.com/commerce/taxonomy/v1/category_tree/0'  // EBAY_US
    : 'https://api.sandbox.ebay.com/commerce/taxonomy/v1/category_tree/0';
  
  console.log(`📡 Calling taxonomy API: ${apiUrl}`);
  
  const response = await fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Taxonomy API Error:', errorText);
    throw new Error(`eBay Taxonomy API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('✅ Taxonomy data fetched successfully');
  console.log(`  - Tree ID: ${data.categoryTreeId}`);
  console.log(`  - Version: ${data.categoryTreeVersion}`);
  
  return data;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseClient.auth.getUser(jwt);

    if (error || !user) {
      throw new Error('Invalid authentication token');
    }

    console.log(`🔐 Authenticated user: ${user.id}`);

    // Check cache first
    if (taxonomyCache && (Date.now() - taxonomyCache.lastUpdated) < CACHE_DURATION_MS) {
      console.log('📋 Returning cached taxonomy data');
      return new Response(JSON.stringify(taxonomyCache.data), {
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=86400' // 24 hours
        },
      });
    }

    // Fetch fresh data
    console.log('🔄 Fetching fresh taxonomy data...');
    const taxonomyData = await fetchEbayTaxonomy();
    
    // Update cache
    taxonomyCache = {
      data: taxonomyData,
      lastUpdated: Date.now(),
      version: taxonomyData.categoryTreeVersion
    };

    console.log('✅ Taxonomy data cached and returned');

    return new Response(JSON.stringify(taxonomyData), {
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400' // 24 hours
      },
    });

  } catch (error) {
    console.error('💥 Error in ebay-taxonomy function:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      details: error.stack
    }), {
      status: 500,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      },
    });
  }
}); 