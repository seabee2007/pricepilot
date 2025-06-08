import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

interface VehicleRequest {
  make: string;
  model: string;
  year: number;
  mileage?: number;
  trim?: string;
  zipCode?: string;
}

interface VehicleValueResponse {
  low: number;
  avg: number;
  high: number;
  make: string;
  model: string;
  year: number;
  source: string;
  timestamp: string;
  success: boolean;
  cached?: boolean;
  currency: string;
}

async function scrapeAutoTrader(make: string, model: string, year: number): Promise<number[]> {
  try {
    const searchUrl = `https://www.autotrader.com/cars-for-sale/all-cars/${make}/${model}/${year}?searchRadius=0&zip=90210`;
    
    console.log(`🔍 Scraping AutoTrader: ${searchUrl}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!response.ok) {
      console.error(`❌ AutoTrader request failed: ${response.status}`);
      throw new Error(`AutoTrader request failed: ${response.status}`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    if (!doc) {
      throw new Error('Failed to parse HTML');
    }

    const prices: number[] = [];
    
    // Try multiple selector patterns for AutoTrader prices
    const selectors = [
      '[data-cmp="vehicleCardPricingDetails"] .first-price',
      '.vehicle-card-pricing .first-price',
      '.first-price',
      '[data-testid="vehicle-card-price"]',
      '.inventory-listing-price',
      '[data-cy="vehicle-card-price"]'
    ];

    for (const selector of selectors) {
      const priceElements = doc.querySelectorAll(selector);
      console.log(`🔍 Found ${priceElements.length} elements with selector: ${selector}`);
      
      priceElements.forEach((el) => {
        const text = el?.textContent?.trim() || '';
        // Remove all non-numeric characters except decimal points
        const priceMatch = text.match(/[\d,]+\.?\d*/);
        if (priceMatch) {
          const cleanPrice = priceMatch[0].replace(/,/g, '');
          const price = parseFloat(cleanPrice);
          if (!isNaN(price) && price > 1000 && price < 200000) { // Reasonable vehicle price range
            prices.push(price);
            console.log(`💰 Found price: $${price} from text: "${text}"`);
          }
        }
      });
      
      if (prices.length > 0) break; // Use first successful selector
    }

    console.log(`✅ AutoTrader scraped ${prices.length} prices`);
    return prices;
  } catch (error) {
    console.error('❌ AutoTrader scraping error:', error);
    return [];
  }
}

async function scrapeCarscom(make: string, model: string, year: number): Promise<number[]> {
  try {
    const searchUrl = `https://www.cars.com/shopping/results/?stock_type=used&makes[]=${make.toLowerCase()}&models[]=${make.toLowerCase()}-${model.toLowerCase()}&list_price_max=&maximum_distance=all&zip=90210&year_max=${year}&year_min=${year}`;
    
    console.log(`🔍 Scraping Cars.com: ${searchUrl}`);
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      console.error(`❌ Cars.com request failed: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    if (!doc) {
      return [];
    }

    const prices: number[] = [];
    
    // Cars.com price selectors
    const selectors = [
      '.price-section .primary-price',
      '[data-testid="vehicle-card-price"]',
      '.vehicle-card-price',
      '.listing-price'
    ];

    for (const selector of selectors) {
      const priceElements = doc.querySelectorAll(selector);
      console.log(`🔍 Found ${priceElements.length} elements with selector: ${selector}`);
      
      priceElements.forEach((el) => {
        const text = el?.textContent?.trim() || '';
        const priceMatch = text.match(/\$?([\d,]+)/);
        if (priceMatch) {
          const price = parseFloat(priceMatch[1].replace(/,/g, ''));
          if (!isNaN(price) && price > 1000 && price < 200000) {
            prices.push(price);
            console.log(`💰 Found price: $${price} from text: "${text}"`);
          }
        }
      });
      
      if (prices.length > 0) break;
    }

    console.log(`✅ Cars.com scraped ${prices.length} prices`);
    return prices;
  } catch (error) {
    console.error('❌ Cars.com scraping error:', error);
    return [];
  }
}

serve(async (req) => {
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

    console.log("🚗 Vehicle market value scraping request received");

    const { make, model, year, mileage, trim, zipCode }: VehicleRequest = await req.json();
    
    if (!make || !model || !year) {
      return new Response(JSON.stringify({ 
        error: "make, model & year are required",
        success: false 
      }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }

    console.log(`🔍 Scraping market value for ${year} ${make} ${model}`);

    // Check cache first
    const cacheKey = `${make}-${model}-${year}`.toLowerCase();
    const { data: cached } = await supabase
      .from("vehicle_value_cache")
      .select("*")
      .eq("cache_key", cacheKey)
      .gte("created_at", new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()) // 4 hours cache
      .single();

    if (cached) {
      console.log("📋 Returning cached scraped vehicle value");
      return new Response(JSON.stringify({
        ...cached.value_data,
        cached: true,
        success: true
      }), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }

    // Scrape from multiple sources in parallel
    const [autoTraderPrices, carsPrices] = await Promise.all([
      scrapeAutoTrader(make, model, year),
      scrapeCarscom(make, model, year)
    ]);

    // Combine all prices
    const allPrices = [...autoTraderPrices, ...carsPrices];

    if (allPrices.length === 0) {
      return new Response(JSON.stringify({
        error: `No market data found for ${year} ${make} ${model}. Try a different vehicle or check back later.`,
        success: false
      }), {
        status: 404,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }

    // Calculate statistics
    const sortedPrices = allPrices.sort((a, b) => a - b);
    const low = sortedPrices[0];
    const high = sortedPrices[sortedPrices.length - 1];
    const avg = Math.round(allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length);

    console.log(`✅ Found ${allPrices.length} prices: Low=$${low}, Avg=$${avg}, High=$${high}`);

    const vehicleValue: VehicleValueResponse = {
      low,
      avg,
      high,
      make,
      model,
      year,
      source: "web_scraping",
      timestamp: new Date().toISOString(),
      success: true,
      currency: "USD"
    };

    // Cache the result
    try {
      await supabase
        .from("vehicle_value_cache")
        .upsert({
          cache_key: cacheKey,
          make,
          model,
          year,
          value_data: vehicleValue
        });
    } catch (cacheError) {
      console.warn("⚠️ Failed to cache result:", cacheError);
    }

    // Save to price history
    try {
      await supabase
        .from("price_history")
        .insert({
          query: `${year} ${make} ${model}`,
          avg_price: avg,
          min_price: low,
          max_price: high,
          data_source: "web_scraping",
          listing_type: "market_value",
          item_count: allPrices.length
        });
    } catch (historyError) {
      console.warn("⚠️ Failed to save to price history:", historyError);
    }

    return new Response(JSON.stringify(vehicleValue), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });

  } catch (e: any) {
    console.error("💥 Unexpected error:", e);
    return new Response(JSON.stringify({ 
      error: e.message || "Internal server error",
      success: false 
    }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });
  }
}); 