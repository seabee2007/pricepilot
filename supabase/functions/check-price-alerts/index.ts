// This is a Supabase Edge Function that runs on a schedule to check for price alerts
// and send notifications when prices drop below thresholds

import { createClient } from "npm:@supabase/supabase-js@2.39.8";

// Types
interface SavedSearch {
  id: string;
  user_id: string;
  query: string;
  filters: {
    conditionIds?: number[];
    freeShipping?: boolean;
    sellerLocation?: string;
    buyItNowOnly?: boolean;
    postalCode?: string;
  };
  price_threshold: number;
  last_checked_price: number | null;
}

interface ItemSummary {
  itemId: string;
  title: string;
  price: {
    value: number;
    currency: string;
  };
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// eBay API helpers
const getOAuthToken = async (): Promise<string> => {
  const clientId = Deno.env.get("EBAY_CLIENT_ID");
  const clientSecret = Deno.env.get("EBAY_CLIENT_SECRET");
  
  if (!clientId || !clientSecret) {
    throw new Error("Missing eBay API credentials");
  }
  
  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${credentials}`,
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
  });
  
  if (!response.ok) {
    throw new Error(`eBay OAuth error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.access_token;
};

const buildFilterString = (filters: SavedSearch["filters"]): string => {
  const filterParts: string[] = [];
  
  if (filters.conditionIds && filters.conditionIds.length > 0) {
    filterParts.push(`conditionIds:{${filters.conditionIds.join(",")}}`);
  }
  
  if (filters.freeShipping) {
    filterParts.push("maxDeliveryCost:0");
  }
  
  if (filters.sellerLocation) {
    filterParts.push(`itemLocation:${filters.sellerLocation}`);
  }
  
  if (filters.buyItNowOnly) {
    filterParts.push("buyingOptions:{FIXED_PRICE}");
  }
  
  return filterParts.join(",");
};

const searchLiveItems = async (query: string, filters: SavedSearch["filters"]): Promise<ItemSummary[]> => {
  const token = await getOAuthToken();
  const filterString = buildFilterString(filters);
  
  const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
  url.searchParams.append("q", query);
  url.searchParams.append("sort", "price");
  
  if (filterString) {
    url.searchParams.append("filter", filterString);
  }
  
  url.searchParams.append("limit", "5"); // Only need a few items to check lowest price
  
  const response = await fetch(url.toString(), {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    },
  });
  
  if (!response.ok) {
    throw new Error(`eBay API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.itemSummaries || [];
};

// Email helper function (simplified - in a real app, use a proper email service)
const sendPriceAlert = async (userId: string, query: string, newPrice: number, threshold: number) => {
  // Get user's email
  const { data: userData, error: userError } = await supabase
    .from("auth.users")
    .select("email")
    .eq("id", userId)
    .single();
  
  if (userError || !userData) {
    console.error("Error fetching user email:", userError);
    return;
  }
  
  const email = userData.email;
  
  // In a real implementation, you would send an email using a service like SendGrid
  console.log(`[ALERT] Sending price alert to ${email} for ${query}`);
  console.log(`Price dropped to $${newPrice} (below threshold of $${threshold})`);
  
  // For demonstration, we'll just log it - real implementation would call an email API
};

// Main function
const checkPriceAlerts = async () => {
  console.log("Starting price alert check job");
  
  try {
    // Get all saved searches
    const { data: savedSearches, error } = await supabase
      .from("saved_searches")
      .select("*");
    
    if (error) {
      throw error;
    }
    
    console.log(`Found ${savedSearches?.length || 0} saved searches to check`);
    
    // Process each saved search
    for (const search of (savedSearches || [])) {
      try {
        // Search for current listings
        const items = await searchLiveItems(search.query, search.filters);
        
        if (items.length === 0) {
          console.log(`No items found for query: ${search.query}`);
          continue;
        }
        
        // Find lowest price
        const lowestPrice = Math.min(...items.map(item => item.price.value));
        
        console.log(`Query: ${search.query}, Lowest price: $${lowestPrice}, Threshold: $${search.price_threshold}`);
        
        // Check if price is below threshold and lower than last checked price
        if (
          lowestPrice < search.price_threshold && 
          (!search.last_checked_price || lowestPrice < search.last_checked_price)
        ) {
          // Send price alert
          await sendPriceAlert(search.user_id, search.query, lowestPrice, search.price_threshold);
        }
        
        // Update last_checked_price
        await supabase
          .from("saved_searches")
          .update({ last_checked_price: lowestPrice })
          .eq("id", search.id);
        
      } catch (searchError) {
        console.error(`Error processing search ${search.id} for query "${search.query}":`, searchError);
        // Continue with next search
      }
    }
    
    console.log("Price alert check job completed");
    
  } catch (err) {
    console.error("Error in price alert check job:", err);
  }
};

// Handle the request
Deno.serve(async (req) => {
  try {
    // Check if this is a scheduled invocation
    const isScheduled = req.headers.get("Authorization") === `Bearer ${Deno.env.get("CRON_SECRET")}`;
    
    if (!isScheduled && req.method !== "POST") {
      return new Response("Unauthorized", { status: 401 });
    }
    
    // Run the price alert check
    await checkPriceAlerts();
    
    return new Response(
      JSON.stringify({ success: true, message: "Price alerts checked successfully" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error:", error);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});