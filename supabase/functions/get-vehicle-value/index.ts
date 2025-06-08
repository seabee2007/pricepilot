import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Initialize Supabase client for logging/caching
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
  value: number;
  currency: string;
  make: string;
  model: string;
  year: number;
  source: string;
  timestamp: string;
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

    console.log("🚗 Vehicle value lookup request received");

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

    console.log(`🔍 Looking up value for ${year} ${make} ${model}`);

    // Check for required environment variables
    const rapidApiKey = Deno.env.get("RAPIDAPI_KEY");
    const rapidApiHost = Deno.env.get("RAPIDAPI_HOST") || "vehicle-pricing-api.p.rapidapi.com";

    if (!rapidApiKey) {
      console.error("❌ RAPIDAPI_KEY environment variable not set");
      return new Response(JSON.stringify({ 
        error: "API configuration missing",
        success: false 
      }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }

    // Check cache first (optional optimization)
    const cacheKey = `${make}-${model}-${year}`.toLowerCase();
    const { data: cached } = await supabase
      .from("vehicle_value_cache")
      .select("*")
      .eq("cache_key", cacheKey)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // 24 hours
      .single();

    if (cached) {
      console.log("📋 Returning cached vehicle value");
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

    // Build the RapidAPI URL
    const url = new URL("https://vehicle-pricing-api.p.rapidapi.com/get%2Bvehicle%2Bvalue");
    url.searchParams.set("maker", make);
    url.searchParams.set("model", model);
    url.searchParams.set("year", String(year));
    
    if (mileage) url.searchParams.set("mileage", String(mileage));
    if (trim) url.searchParams.set("trim", trim);
    if (zipCode) url.searchParams.set("zip", zipCode);

    console.log("📡 Calling RapidAPI:", url.toString());

    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-Rapidapi-Key": rapidApiKey,
        "X-Rapidapi-Host": rapidApiHost,
      },
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("❌ RapidAPI error:", resp.status, err);
      
      let errorMessage = `API error: ${err}`;
      let statusCode = resp.status;
      
      // Handle specific error cases
      if (resp.status === 429) {
        errorMessage = "Rate limit exceeded. The vehicle pricing API has reached its request limit. Please try again in a few minutes.";
        console.warn("⚠️ Rate limit hit for vehicle pricing API");
      } else if (resp.status === 401) {
        errorMessage = "API authentication failed. Please check API key configuration.";
      } else if (resp.status === 403) {
        errorMessage = "API access forbidden. Please check API subscription status.";
      } else if (resp.status >= 500) {
        errorMessage = "Vehicle pricing service is temporarily unavailable. Please try again later.";
      }
      
      return new Response(JSON.stringify({ 
        error: errorMessage,
        success: false,
        status: statusCode
      }), {
        status: statusCode,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }

    const apiData = await resp.json();
    console.log("✅ RapidAPI response:", apiData);

    // Format response
    const vehicleValue: VehicleValueResponse = {
      value: apiData.value || 0,
      currency: apiData.currency || "USD",
      make,
      model,
      year,
      source: "rapidapi_vehicle_pricing",
      timestamp: new Date().toISOString()
    };

    // Cache the result (create table if needed)
    try {
      await supabase
        .from("vehicle_value_cache")
        .insert({
          cache_key: cacheKey,
          make,
          model,
          year,
          value_data: vehicleValue
        });
    } catch (cacheError) {
      console.warn("⚠️ Failed to cache result:", cacheError);
      // Continue without caching
    }

    // Optionally save to price history for tracking
    try {
      await supabase
        .from("price_history")
        .insert({
          query: `${year} ${make} ${model}`,
          avg_price: vehicleValue.value,
          data_source: "rapidapi_vehicle_pricing",
          listing_type: "market_value",
          item_count: 1
        });
    } catch (historyError) {
      console.warn("⚠️ Failed to save to price history:", historyError);
      // Continue without saving
    }

    return new Response(JSON.stringify({
      ...vehicleValue,
      success: true
    }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });

  } catch (e: any) {
    console.error("💥 Unexpected error:", e);
    return new Response(JSON.stringify({ 
      error: e.message,
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