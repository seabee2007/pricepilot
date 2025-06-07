// This is a Supabase Edge Function that runs on a schedule to check for price alerts
// and send notifications when prices drop below thresholds

import { createClient } from "npm:@supabase/supabase-js@2.49.1";

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

interface UserProfile {
  email: string;
  full_name?: string;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

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

// Email helper function using Resend
const sendPriceAlert = async (userId: string, query: string, newPrice: number, threshold: number) => {
  try {
    // Get user's profile information using admin API
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !userData.user) {
      console.error("Error fetching user:", userError);
      return;
    }
    
    const userEmail = userData.user.email;
    const userName = userData.user.user_metadata?.full_name || userData.user.email?.split('@')[0] || 'there';
    
    if (!userEmail) {
      console.error("No email found for user:", userId);
      return;
    }

    // Check if we have Resend API key
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("Missing RESEND_API_KEY environment variable");
      return;
    }

    // Format price drop percentage
    const priceDropPercent = threshold > 0 ? Math.round(((threshold - newPrice) / threshold) * 100) : 0;
    const savings = threshold - newPrice;

    // Create HTML email content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>PricePilot Alert</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px 20px; }
            .alert-card { background: white; border-radius: 8px; padding: 25px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
            .price-highlight { font-size: 28px; font-weight: bold; color: #059669; margin: 15px 0; }
            .savings { background: #dcfce7; color: #166534; padding: 10px 15px; border-radius: 6px; margin: 15px 0; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Price Alert!</h1>
              <p>Your watched item has dropped in price</p>
            </div>
            
            <div class="content">
              <div class="alert-card">
                <h2>Hi ${userName}!</h2>
                <p>Great news! The price for "<strong>${query}</strong>" has dropped below your alert threshold.</p>
                
                <div class="price-highlight">
                  New Price: $${newPrice.toFixed(2)}
                </div>
                
                <div class="savings">
                  💰 You're saving $${savings.toFixed(2)} (${priceDropPercent}% below your alert of $${threshold.toFixed(2)})
                </div>
                
                <p>This is a great time to check out the latest listings and potentially make a purchase!</p>
                
                <a href="https://pricepilot.app/results?q=${encodeURIComponent(query)}&mode=buy" class="button">
                  View Current Listings →
                </a>
              </div>
              
              <div class="alert-card">
                <h3>💡 Pro Tips:</h3>
                <ul>
                  <li>Prices can change quickly on eBay - act fast if you see something you like</li>
                  <li>Check the seller's feedback and return policy before purchasing</li>
                  <li>Consider shipping costs when comparing total prices</li>
                </ul>
              </div>
            </div>
            
            <div class="footer">
              <p>You're receiving this because you set up a price alert on PricePilot.</p>
              <p>Happy shopping! 🛒</p>
              <p style="margin-top: 20px; font-size: 12px;">
                PricePilot - Your eBay Price Tracking Companion
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email using Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PricePilot Alerts <alerts@pricepilot.app>",
        to: [userEmail],
        subject: `🎉 Price Alert: ${query} dropped to $${newPrice.toFixed(2)}!`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      console.error("Resend API error:", error);
      throw new Error(`Failed to send email: ${emailResponse.status}`);
    }

    const emailData = await emailResponse.json();
    console.log(`✅ Price alert email sent successfully to ${userEmail} (Message ID: ${emailData.id})`);
    console.log(`📧 Alert: ${query} dropped to $${newPrice} (below threshold of $${threshold})`);
    
  } catch (error) {
    console.error("Error sending price alert email:", error);
    throw error;
  }
};

// Main function
const checkPriceAlerts = async () => {
  console.log("🔍 Starting price alert check job");
  
  try {
    // Get all saved searches
    const { data: savedSearches, error } = await supabase
      .from("saved_searches")
      .select("*");
    
    if (error) {
      throw error;
    }
    
    console.log(`📊 Found ${savedSearches?.length || 0} saved searches to check`);
    
    if (!savedSearches || savedSearches.length === 0) {
      console.log("No saved searches found. Job completed.");
      return;
    }
    
    let alertsSent = 0;
    let searchesChecked = 0;
    
    // Process each saved search
    for (const search of savedSearches) {
      try {
        searchesChecked++;
        console.log(`🔍 Checking search ${searchesChecked}/${savedSearches.length}: "${search.query}"`);
        
        // Search for current listings
        const items = await searchLiveItems(search.query, search.filters);
        
        if (items.length === 0) {
          console.log(`⚠️ No items found for query: ${search.query}`);
          continue;
        }
        
        // Find lowest price
        const lowestPrice = Math.min(...items.map(item => item.price.value));
        
        console.log(`💰 Query: "${search.query}" | Lowest: $${lowestPrice} | Threshold: $${search.price_threshold} | Last: $${search.last_checked_price || 'N/A'}`);
        
        // Check if price is below threshold and lower than last checked price
        if (
          lowestPrice < search.price_threshold && 
          (!search.last_checked_price || lowestPrice < search.last_checked_price)
        ) {
          console.log(`🚨 ALERT TRIGGERED for "${search.query}" - sending email...`);
          
          // Send price alert
          await sendPriceAlert(search.user_id, search.query, lowestPrice, search.price_threshold);
          alertsSent++;
        }
        
        // Update last_checked_price
        await supabase
          .from("saved_searches")
          .update({ last_checked_price: lowestPrice })
          .eq("id", search.id);
        
      } catch (searchError) {
        console.error(`❌ Error processing search ${search.id} for query "${search.query}":`, searchError);
        // Continue with next search
      }
    }
    
    console.log(`✅ Price alert check job completed`);
    console.log(`📊 Stats: ${searchesChecked} searches checked, ${alertsSent} alerts sent`);
    
  } catch (err) {
    console.error("❌ Error in price alert check job:", err);
    throw err;
  }
};

// Handle the request
Deno.serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }
    
    // Check if this is a scheduled invocation or manual trigger
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");
    const isScheduled = authHeader === `Bearer ${cronSecret}`;
    const isManualTrigger = req.method === "POST" && !cronSecret; // Allow manual triggers in dev
    
    if (!isScheduled && !isManualTrigger) {
      console.log("❌ Unauthorized request");
      return new Response("Unauthorized", { status: 401 });
    }
    
    if (isScheduled) {
      console.log("⏰ Running scheduled price alert check");
    } else {
      console.log("🔧 Running manual price alert check");
    }
    
    // Run the price alert check
    await checkPriceAlerts();
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Price alerts checked successfully",
        timestamp: new Date().toISOString()
      }),
      {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        status: 200,
      }
    );
    
  } catch (error) {
    console.error("❌ Error in price alert handler:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        status: 500,
      }
    );
  }
});