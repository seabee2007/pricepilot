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

// eBay API helper to get current item details
const getItemDetails = async (itemId: string): Promise<any> => {
  const token = await getOAuthToken();
  
  const url = new URL("https://api.ebay.com/buy/browse/v1/item/" + encodeURIComponent(itemId));
  
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
  return data;
};

// Main function
const checkPriceAlerts = async (requestBody: any = {}) => {
  console.log("🔍 Starting price alert check job for individual saved items");
  
  try {
    // Get all saved individual items with price alerts set
    const { data: savedItems, error } = await supabase
      .from("saved_items")
      .select("*")
      .eq("item_type", "item")
      .not("item_id", "is", null)
      .not("price_alert_threshold", "is", null);
    
    if (error) {
      throw error;
    }
    
    console.log(`📊 Found ${savedItems?.length || 0} saved items with price alerts to check`);
    
    if (!savedItems || savedItems.length === 0) {
      console.log("No saved items with price alerts found. Job completed.");
      return;
    }
    
    let alertsSent = 0;
    let itemsChecked = 0;
    
    // Process each saved item
    for (const savedItem of savedItems) {
      try {
        itemsChecked++;
        console.log(`🔍 Checking item ${itemsChecked}/${savedItems.length}: "${savedItem.title}" (${savedItem.item_id})`);
        
        // Get current item details from eBay
        const itemDetails = await getItemDetails(savedItem.item_id);
        
        if (!itemDetails || !itemDetails.price) {
          console.log(`⚠️ No current price found for item: ${savedItem.item_id}`);
          continue;
        }
        
        const currentPrice = parseFloat(itemDetails.price.value) || 0;
        const threshold = savedItem.price_alert_threshold || 0;
        
        console.log(`💰 Item: "${savedItem.title}" | Current: $${currentPrice} | Threshold: $${threshold} | Last: $${savedItem.last_checked_price || 'N/A'}`);
        console.log(`🔗 eBay URL: ${savedItem.item_url}`);
        
        // Check if price is below threshold
        // For manual triggers, be more lenient; for scheduled checks, only send if price dropped further
        const shouldSendAlert = threshold > 0 && currentPrice < threshold && (
          // Always send if never checked before
          !savedItem.last_checked_price ||
          // For manual triggers, send if price is below threshold (even if same as last check)
          (requestBody?.trigger === 'manual' && currentPrice <= threshold) ||
          // For scheduled checks, only send if price dropped further
          (requestBody?.trigger !== 'manual' && currentPrice < savedItem.last_checked_price)
        );
        
        if (shouldSendAlert) {
          console.log(`🚨 PRICE ALERT TRIGGERED for "${savedItem.title}" - sending email...`);
          console.log(`💰 Details: Current=$${currentPrice}, Threshold=$${threshold}, Last=$${savedItem.last_checked_price || 'N/A'}, Trigger=${requestBody?.trigger || 'scheduled'}`);
          
          // Send price alert with specific item details
          await sendPriceAlert(
            savedItem.user_id, 
            savedItem.title, 
            currentPrice, 
            threshold,
            savedItem.item_url,
            savedItem.title
          );
          alertsSent++;
        } else {
          console.log(`⏭️ No alert sent for "${savedItem.title}" - Current=$${currentPrice}, Threshold=$${threshold}, Last=$${savedItem.last_checked_price || 'N/A'}`);
        }
        
        // Update last_checked_price in the saved_items table
        await supabase
          .from("saved_items")
          .update({ last_checked_price: currentPrice })
          .eq("id", savedItem.id);
        
      } catch (itemError) {
        console.error(`❌ Error processing saved item ${savedItem.id} (${savedItem.item_id}):`, itemError);
        
        // Check if it's an item not found error (item may have ended/been removed)
        if (itemError.message.includes('404') || itemError.message.includes('not found')) {
          console.log(`🗑️ Item ${savedItem.item_id} appears to have been removed from eBay`);
          // Could optionally mark item as inactive or notify user
        }
        
        // Continue with next item
      }
    }
    
    console.log(`✅ Price alert check job completed`);
    console.log(`📊 Stats: ${itemsChecked} items checked, ${alertsSent} alerts sent`);
    
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
      console.log("📧 Testing price alerts with real saved item data...");
      
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
        
        // Get user's saved individual items
        const { data: savedItems, error: savedError } = await supabase
          .from("saved_items")
          .select("*")
          .eq("user_id", user.id)
          .eq("item_type", "item")
          .not("item_id", "is", null)
          .limit(1); // Just test with their first saved item
        
        if (savedError) {
          throw new Error(`Failed to fetch saved items: ${savedError.message}`);
        }
        
        if (!savedItems || savedItems.length === 0) {
          console.log("📧 No saved individual items found, sending general test email...");
          
          // Send a test email explaining they need to save items first
          await sendPriceAlert(
            user.id, 
            "No Saved Items", 
            0, 
            0,
            "https://ebay.com",
            "Welcome to PricePilot! Save some eBay items to start receiving price alerts when their prices drop."
          );
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Test email sent! Note: You don't have any saved items yet. Save some eBay items to receive real price alerts.",
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
        console.log(`📧 Testing with saved item: "${savedItem.title}" (${savedItem.item_id})`);
        
        // Get real current price from eBay
        const itemDetails = await getItemDetails(savedItem.item_id);
        
        if (!itemDetails || !itemDetails.price) {
          throw new Error(`No current price found for item "${savedItem.title}" (${savedItem.item_id})`);
        }
        
        const currentPrice = parseFloat(itemDetails.price.value) || 0;
        const threshold = savedItem.price_alert_threshold || (currentPrice + 50); // Use a threshold above current price for testing
        
        console.log(`📧 Real data - Item: "${savedItem.title}", Current Price: $${currentPrice}, Test Threshold: $${threshold}`);
        console.log(`📧 Item URL: ${savedItem.item_url}`);
        
        // Send price alert with real eBay data
        await sendPriceAlert(
          user.id, 
          savedItem.title, 
          currentPrice, 
          threshold,
          savedItem.item_url,
          savedItem.title
        );
        
        console.log(`✅ Test email sent successfully with real eBay data for ${user.email}`);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Test email sent with real data for "${savedItem.title}"! Current price: $${currentPrice}. Check your inbox.`,
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
    await checkPriceAlerts(requestBody);
    
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