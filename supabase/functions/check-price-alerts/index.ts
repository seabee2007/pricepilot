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
  itemWebUrl: string;
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
const sendPriceAlert = async (userId: string, query: string, newPrice: number, threshold: number, itemUrl: string, itemTitle: string) => {
  try {
    console.log(`📧 Starting sendPriceAlert for user: ${userId}, query: ${query}`);
    
    // Get user's profile information using admin API
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !userData.user) {
      console.error("❌ Error fetching user:", userError);
      throw new Error(`Failed to fetch user data: ${userError?.message || 'User not found'}`);
    }
    
    const userEmail = userData.user.email;
    const userName = userData.user.user_metadata?.full_name || userData.user.email?.split('@')[0] || 'there';
    
    console.log(`📧 User email: ${userEmail}, userName: ${userName}`);
    
    if (!userEmail) {
      console.error("❌ No email found for user:", userId);
      throw new Error(`No email address found for user ${userId}`);
    }

    // Check if we have Resend API key
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    console.log(`🔑 Resend API key present: ${!!resendApiKey}`);
    if (!resendApiKey) {
      const error = "Missing RESEND_API_KEY environment variable";
      console.error("❌", error);
      throw new Error(error);
    }

    // Format price drop percentage
    const priceDropPercent = threshold > 0 ? Math.round(((threshold - newPrice) / threshold) * 100) : 0;
    const savings = threshold - newPrice;

    console.log(`💰 Price details - New: $${newPrice}, Threshold: $${threshold}, Savings: $${savings.toFixed(2)}`);

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
            .item-title { font-style: italic; color: #4b5563; margin: 10px 0; }
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
                <p>Great news! We found a specific item matching "<strong>${query}</strong>" that has dropped below your alert threshold.</p>
                
                <div class="item-title">
                  "${itemTitle}"
                </div>
                
                <div class="price-highlight">
                  New Price: $${newPrice.toFixed(2)}
                </div>
                
                <div class="savings">
                  💰 You're saving $${savings.toFixed(2)} (${priceDropPercent}% below your alert of $${threshold.toFixed(2)})
                </div>
                
                <p>This is a great time to check out this specific listing and potentially make a purchase!</p>
                
                <a href="${itemUrl}" class="button">
                  View This Item on eBay →
                </a>
                
                <p style="margin-top: 20px; text-align: center;">
                  <a href="https://pricepilot.online/results?q=${encodeURIComponent(query)}&mode=buy" style="color: #3b82f6; text-decoration: none; font-size: 14px;">
                    📊 Track more prices on PricePilot
                  </a>
                </p>
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

    console.log(`📬 Preparing to send email via Resend API...`);

    // Prepare email payload
    const emailPayload = {
      from: "PricePilot Alerts <alerts@pricepilot.online>",
      to: [userEmail],
      subject: `🎉 Price Alert: ${query} dropped to $${newPrice.toFixed(2)}!`,
      html: emailHtml,
    };

    console.log(`📬 Email payload prepared for ${userEmail}`);

    // Send email using Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    console.log(`📬 Resend API response status: ${emailResponse.status} ${emailResponse.statusText}`);

    if (!emailResponse.ok) {
      let errorDetails = `HTTP ${emailResponse.status}: ${emailResponse.statusText}`;
      
      try {
        const errorText = await emailResponse.text();
        console.error("❌ Resend API error response:", errorText);
        errorDetails += ` - ${errorText}`;
      } catch (parseError) {
        console.error("❌ Could not parse Resend error response");
      }
      
      throw new Error(`Resend API failed: ${errorDetails}`);
    }

    const emailData = await emailResponse.json();
    console.log(`✅ Email sent successfully - Message ID: ${emailData.id}`);
    console.log(`📧 Alert: ${query} dropped to $${newPrice} (below threshold of $${threshold}) - Item: ${itemTitle}`);
    
  } catch (error) {
    console.error("❌ Error in sendPriceAlert function:", error);
    console.error("❌ Error details:", {
      message: error.message,
      stack: error.stack,
      userId,
      query,
      newPrice,
      threshold,
      itemUrl,
      itemTitle
    });
    throw error;
  }
};

// Main function
const checkPriceAlerts = async () => {
  console.log("🔍 Starting price alert check job");
  
  try {
    // Get all saved items with search queries (unified table)
    const { data: savedItems, error } = await supabase
      .from("saved_items")
      .select("*")
      .eq("item_type", "search")
      .not("search_query", "is", null);
    
    if (error) {
      throw error;
    }
    
    console.log(`📊 Found ${savedItems?.length || 0} saved search queries to check`);
    
    if (!savedItems || savedItems.length === 0) {
      console.log("No saved search queries found. Job completed.");
      return;
    }
    
    let alertsSent = 0;
    let searchesChecked = 0;
    
    // Process each saved search query
    for (const savedItem of savedItems) {
      try {
        searchesChecked++;
        console.log(`🔍 Checking search ${searchesChecked}/${savedItems.length}: "${savedItem.search_query}"`);
        
        // Search for current listings using the search query and filters
        const items = await searchLiveItems(savedItem.search_query!, savedItem.search_filters || {});
        
        if (items.length === 0) {
          console.log(`⚠️ No items found for query: ${savedItem.search_query}`);
          continue;
        }
        
        // Find the item with the lowest price
        let lowestPriceItem = items[0];
        for (const item of items) {
          if (item.price.value < lowestPriceItem.price.value) {
            lowestPriceItem = item;
          }
        }
        
        const lowestPrice = lowestPriceItem.price.value;
        const threshold = savedItem.price_alert_threshold || 0;
        
        console.log(`💰 Query: "${savedItem.search_query}" | Lowest: $${lowestPrice} | Threshold: $${threshold} | Last: $${savedItem.last_checked_price || 'N/A'}`);
        console.log(`🔗 Lowest price item: "${lowestPriceItem.title}" - ${lowestPriceItem.itemWebUrl}`);
        
        // Check if price is below threshold and lower than last checked price
        if (
          threshold > 0 &&
          lowestPrice < threshold && 
          (!savedItem.last_checked_price || lowestPrice < savedItem.last_checked_price)
        ) {
          console.log(`🚨 ALERT TRIGGERED for "${savedItem.search_query}" - sending email...`);
          
          // Send price alert with specific item details
          await sendPriceAlert(
            savedItem.user_id, 
            savedItem.search_query!, 
            lowestPrice, 
            threshold,
            lowestPriceItem.itemWebUrl,
            lowestPriceItem.title
          );
          alertsSent++;
        }
        
        // Update last_checked_price in the saved_items table
        await supabase
          .from("saved_items")
          .update({ last_checked_price: lowestPrice })
          .eq("id", savedItem.id);
        
      } catch (searchError) {
        console.error(`❌ Error processing saved item ${savedItem.id} for query "${savedItem.search_query}":`, searchError);
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
          "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
        },
      });
    }
    
    // Validate all required environment variables
    const requiredEnvVars = {
      "SUPABASE_URL": Deno.env.get("SUPABASE_URL"),
      "SUPABASE_SERVICE_ROLE_KEY": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      "EBAY_CLIENT_ID": Deno.env.get("EBAY_CLIENT_ID"),
      "EBAY_CLIENT_SECRET": Deno.env.get("EBAY_CLIENT_SECRET"),
      "RESEND_API_KEY": Deno.env.get("RESEND_API_KEY")
    };
    
    const missingVars = Object.entries(requiredEnvVars)
      .filter(([key, value]) => !value)
      .map(([key]) => key);
    
    if (missingVars.length > 0) {
      console.error("❌ Missing required environment variables:", missingVars);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Missing required environment variables: ${missingVars.join(", ")}`,
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
    
    // Check if this is a scheduled invocation or manual trigger
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");
    const isScheduled = authHeader === `Bearer ${cronSecret}`;
    const isManualTrigger = req.method === "POST" && authHeader?.startsWith("Bearer ");
    
    if (!isScheduled && !isManualTrigger) {
      console.log("❌ Unauthorized request - missing or invalid authorization");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing or invalid authorization header",
          timestamp: new Date().toISOString()
        }), 
        { 
          status: 401,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }
    
    if (isScheduled) {
      console.log("⏰ Running scheduled price alert check");
    } else {
      console.log("🔧 Running manual price alert check");
    }
    
    // Parse request body to check for test email trigger
    let requestBody: any = {};
    try {
      const requestText = await req.text();
      if (requestText) {
        requestBody = JSON.parse(requestText);
        console.log("📋 Parsed request body:", requestBody);
      }
    } catch (parseError) {
      console.log("Could not parse request body, continuing with normal flow");
    }
    
    // Handle test email request
    if (requestBody?.trigger === 'test-email' || requestBody?.forceEmail) {
      console.log("📧 Testing price alerts with real data...");
      
      try {
        // Get user from auth header - use service role client to verify token
        const authToken = authHeader?.replace('Bearer ', '');
        if (!authToken) {
          throw new Error("No auth token provided for test email");
        }
        
        // Create a client with the user's token to get their info
        const userSupabase = createClient(supabaseUrl, supabaseKey, {
          global: {
            headers: {
              Authorization: `Bearer ${authToken}`
            }
          }
        });
        
        const { data: { user }, error: userError } = await userSupabase.auth.getUser();
        
        if (userError || !user) {
          console.error("❌ Failed to get user:", userError);
          throw new Error("Invalid auth token or user not found");
        }
        
        console.log(`📧 Authenticated user: ${user.email} (${user.id})`);
        
        // Check environment variables before proceeding
        const resendKey = Deno.env.get("RESEND_API_KEY");
        console.log(`🔑 Environment check - RESEND_API_KEY present: ${!!resendKey}`);
        if (!resendKey) {
          throw new Error("RESEND_API_KEY environment variable is not set");
        }
        
        // Get user's saved search queries
        const { data: savedItems, error: savedError } = await supabase
          .from("saved_items")
          .select("*")
          .eq("user_id", user.id)
          .eq("item_type", "search")
          .not("search_query", "is", null)
          .limit(1); // Just test with their first saved search
        
        if (savedError) {
          throw new Error(`Failed to fetch saved searches: ${savedError.message}`);
        }
        
        if (!savedItems || savedItems.length === 0) {
          console.log("📧 No saved searches found, sending general test email...");
          
          // Send a test email explaining they need to save searches first
          await sendPriceAlert(
            user.id, 
            "No Saved Searches", 
            0, 
            0,
            "https://ebay.com",
            "Welcome to PricePilot! Save some search queries to start receiving price alerts."
          );
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Test email sent! Note: You don't have any saved searches yet. Save some search queries to receive real price alerts.",
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
        }
        
        const savedItem = savedItems[0];
        console.log(`📧 Testing with saved search: "${savedItem.search_query}"`);
        
        // Get real current prices from eBay
        const items = await searchLiveItems(savedItem.search_query!, savedItem.search_filters || {});
        
        if (items.length === 0) {
          throw new Error(`No current eBay listings found for "${savedItem.search_query}"`);
        }
        
        // Find the lowest price item
        let lowestPriceItem = items[0];
        for (const item of items) {
          if (item.price.value < lowestPriceItem.price.value) {
            lowestPriceItem = item;
          }
        }
        
        const currentPrice = lowestPriceItem.price.value;
        const threshold = savedItem.price_alert_threshold || (currentPrice + 50); // Use a threshold above current price for testing
        
        console.log(`📧 Real data - Query: "${savedItem.search_query}", Current Price: $${currentPrice}, Test Threshold: $${threshold}`);
        console.log(`📧 Lowest price item: "${lowestPriceItem.title}"`);
        
        // Send price alert with real eBay data
        await sendPriceAlert(
          user.id, 
          savedItem.search_query!, 
          currentPrice, 
          threshold,
          lowestPriceItem.itemWebUrl,
          lowestPriceItem.title
        );
        
        console.log(`✅ Test email sent successfully with real eBay data for ${user.email}`);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Test email sent with real data for "${savedItem.search_query}"! Current lowest price: $${currentPrice}. Check your inbox.`,
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
        
      } catch (emailError) {
        console.error("❌ Error in test email handler:", emailError);
        console.error("❌ Full error details:", {
          message: emailError.message,
          stack: emailError.stack,
          name: emailError.name
        });
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Test email failed: ${emailError.message}`,
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