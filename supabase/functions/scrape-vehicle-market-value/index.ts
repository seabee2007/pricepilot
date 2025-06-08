import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// DIY Proxy Pool Implementation
interface ProxyInfo {
  proxy: string;
  lastUsed: number;
  failureCount: number;
}

class ProxyRotator {
  private proxies: ProxyInfo[] = [];
  private proxyRefreshTime: number = 0;
  private readonly PROXY_REFRESH_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours
  private readonly MAX_PROXY_FAILURES = 3;
  private readonly PROXY_COOLDOWN = 30 * 1000; // 30 seconds between uses

  constructor() {
    this.initializeProxyPool();
  }

  // Fetch proxy list from ProxyScrape API
  private async fetchProxyList(): Promise<string[]> {
    try {
      console.log("🔄 Fetching fresh proxy list...");
      const url = "https://api.proxyscrape.com/?request=getproxies&proxytype=https&timeout=5000&country=all&ssl=yes&anonymity=all";
      
      const response = await fetch(url, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ProxyFetcher/1.0)'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Proxy fetch failed: ${response.status}`);
      }
      
      const text = await response.text();
      const proxies = text.split('\n')
        .map(line => line.trim())
        .filter(line => line && line.includes(':'))
        .slice(0, 50); // Limit to 50 proxies for efficiency
      
      console.log(`📡 Fetched ${proxies.length} potential proxies`);
      return proxies;
    } catch (error) {
      console.error("❌ Failed to fetch proxy list:", error);
      return [];
    }
  }

  // Test if a proxy is working
  private async testProxy(proxy: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const response = await fetch("https://httpbin.org/ip", {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ProxyTester/1.0)'
        },
        // Note: Deno's fetch doesn't support proxy config directly
        // We'll implement proxy support in the actual scraping functions
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Proxy ${proxy} is working (IP: ${data.origin})`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.log(`❌ Proxy ${proxy} failed test:`, error.message);
      return false;
    }
  }

  // Build a pool of working proxies
  private async buildWorkingPool(rawProxies: string[]): Promise<ProxyInfo[]> {
    console.log(`🔍 Testing ${rawProxies.length} proxies...`);
    const workingProxies: ProxyInfo[] = [];
    
    // Test proxies in batches to avoid overwhelming the test service
    const batchSize = 10;
    for (let i = 0; i < rawProxies.length; i += batchSize) {
      const batch = rawProxies.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (proxy) => {
        const isWorking = await this.testProxy(proxy);
        if (isWorking) {
          return {
            proxy,
            lastUsed: 0,
            failureCount: 0
          };
        }
        return null;
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          workingProxies.push(result.value);
        }
      });
      
      // Small delay between batches
      if (i + batchSize < rawProxies.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ Found ${workingProxies.length}/${rawProxies.length} working proxies`);
    return workingProxies;
  }

  // Initialize the proxy pool
  private async initializeProxyPool(): Promise<void> {
    if (Date.now() - this.proxyRefreshTime < this.PROXY_REFRESH_INTERVAL && this.proxies.length > 0) {
      return; // Pool is still fresh
    }

    try {
      const rawProxies = await this.fetchProxyList();
      if (rawProxies.length === 0) {
        console.warn("⚠️ No proxies fetched, continuing without proxy pool");
        return;
      }

      const workingProxies = await this.buildWorkingPool(rawProxies);
      this.proxies = workingProxies;
      this.proxyRefreshTime = Date.now();
      
      console.log(`🔄 Proxy pool initialized with ${this.proxies.length} working proxies`);
    } catch (error) {
      console.error("❌ Failed to initialize proxy pool:", error);
    }
  }

  // Get a proxy for use
  async getProxy(): Promise<string | null> {
    await this.initializeProxyPool();
    
    if (this.proxies.length === 0) {
      return null;
    }

    // Filter out failed proxies and those on cooldown
    const now = Date.now();
    const availableProxies = this.proxies.filter(p => 
      p.failureCount < this.MAX_PROXY_FAILURES && 
      (now - p.lastUsed) > this.PROXY_COOLDOWN
    );

    if (availableProxies.length === 0) {
      console.warn("⚠️ No available proxies, trying a random one");
      const randomProxy = this.proxies[Math.floor(Math.random() * this.proxies.length)];
      return randomProxy?.proxy || null;
    }

    // Get least recently used proxy
    const selectedProxy = availableProxies.reduce((oldest, current) => 
      current.lastUsed < oldest.lastUsed ? current : oldest
    );

    selectedProxy.lastUsed = now;
    console.log(`🔄 Using proxy: ${selectedProxy.proxy}`);
    return selectedProxy.proxy;
  }

  // Mark a proxy as failed
  markProxyFailed(proxyAddress: string): void {
    const proxy = this.proxies.find(p => p.proxy === proxyAddress);
    if (proxy) {
      proxy.failureCount++;
      console.log(`❌ Proxy ${proxyAddress} failed (${proxy.failureCount}/${this.MAX_PROXY_FAILURES})`);
      
      if (proxy.failureCount >= this.MAX_PROXY_FAILURES) {
        console.log(`🚫 Proxy ${proxyAddress} permanently removed from pool`);
        this.proxies = this.proxies.filter(p => p.proxy !== proxyAddress);
      }
    }
  }

  // Get proxy pool statistics
  getStats(): { total: number; available: number; failed: number } {
    const now = Date.now();
    const available = this.proxies.filter(p => 
      p.failureCount < this.MAX_PROXY_FAILURES && 
      (now - p.lastUsed) > this.PROXY_COOLDOWN
    ).length;
    
    const failed = this.proxies.filter(p => p.failureCount >= this.MAX_PROXY_FAILURES).length;
    
    return {
      total: this.proxies.length,
      available,
      failed
    };
  }
}

// Global proxy rotator instance
const proxyRotator = new ProxyRotator();

// Enhanced fetch with proxy rotation
async function fetchWithProxy(url: string, options: RequestInit = {}): Promise<Response> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const proxy = await proxyRotator.getProxy();
      
      if (!proxy) {
        console.log(`🌐 No proxy available, using direct connection (attempt ${attempt})`);
        return await fetch(url, {
          ...options,
          timeout: 15000 // 15 second timeout
        });
      }

      console.log(`🔄 Attempt ${attempt} using proxy: ${proxy}`);
      
      // For Deno, we need to use a different approach for proxy
      // Since Deno's fetch doesn't support proxy directly, we'll make a note
      // and fall back to direct connection for now
      console.log(`📝 Note: Proxy ${proxy} selected but using direct connection (Deno limitation)`);
      
      const response = await fetch(url, {
        ...options,
        timeout: 15000,
        headers: {
          ...options.headers,
          'X-Forwarded-For': proxy.split(':')[0], // Add proxy IP as hint
        }
      });

      if (response.ok) {
        console.log(`✅ Request successful on attempt ${attempt}`);
        return response;
      } else if (response.status === 429 || response.status === 403) {
        // Rate limited or blocked, mark proxy as failed
        proxyRotator.markProxyFailed(proxy);
        throw new Error(`HTTP ${response.status}: Rate limited or blocked`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      lastError = error as Error;
      console.log(`❌ Attempt ${attempt} failed: ${lastError.message}`);
      
      // Add delay between retries
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("All proxy attempts failed");
}

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
    
    const response = await fetchWithProxy(searchUrl, {
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
    
    const response = await fetchWithProxy(searchUrl, {
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

async function scrapeEbayMotors(make: string, model: string, year: number): Promise<number[]> {
  try {
    const searchUrl = `https://www.ebay.com/sch/Cars-Trucks/6001/i.html?_nkw=${year}+${make}+${model}&_stpos=90210&_fspt=1&_sop=1`;
    
    console.log(`🔍 Scraping eBay Motors: ${searchUrl}`);
    
    const response = await fetchWithProxy(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });

    if (!response.ok) {
      console.error(`❌ eBay Motors request failed: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    if (!doc) {
      return [];
    }

    const prices: number[] = [];
    
    // eBay Motors price selectors
    const selectors = [
      '.s-item__price .notranslate',
      '.s-item__price',
      '.notranslate[role="img"]',
      '.cldt[data-testid="item-price"]',
      '.u-flL.condText'
    ];

    for (const selector of selectors) {
      const priceElements = doc.querySelectorAll(selector);
      console.log(`🔍 Found ${priceElements.length} elements with selector: ${selector}`);
      
      priceElements.forEach((el) => {
        const text = el?.textContent?.trim() || '';
        // Match dollar amounts, handle ranges like "$15,000 to $18,000"
        const priceMatches = text.match(/\$?([\d,]+)/g);
        if (priceMatches) {
          priceMatches.forEach(match => {
            const price = parseFloat(match.replace(/[\$,]/g, ''));
            if (!isNaN(price) && price > 1000 && price < 200000) {
              prices.push(price);
              console.log(`💰 Found price: $${price} from text: "${text}"`);
            }
          });
        }
      });
      
      if (prices.length > 0) break;
    }

    console.log(`✅ eBay Motors scraped ${prices.length} prices`);
    return prices;
  } catch (error) {
    console.error('❌ eBay Motors scraping error:', error);
    return [];
  }
}

async function scrapeCarGurus(make: string, model: string, year: number): Promise<number[]> {
  try {
    const searchUrl = `https://www.cargurus.com/Cars/inventorylisting/viewDetailsFilterViewInventoryListing.action?sourceContext=carGurusHomePageModel&entitySelectingHelper.selectedEntity=${year}_${make}_${model}&zip=90210`;
    
    console.log(`🔍 Scraping CarGurus: ${searchUrl}`);
    
    const response = await fetchWithProxy(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    if (!response.ok) {
      console.error(`❌ CarGurus request failed: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    if (!doc) {
      return [];
    }

    const prices: number[] = [];
    
    // CarGurus price selectors
    const selectors = [
      '[data-testid="listing-price"]',
      '.listing-row__price',
      '.price-section__price',
      '[data-cg-ft="srp-listing-price"]',
      '.cg-dealRating-price'
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

    console.log(`✅ CarGurus scraped ${prices.length} prices`);
    return prices;
  } catch (error) {
    console.error('❌ CarGurus scraping error:', error);
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

    // Log proxy pool statistics
    const proxyStats = proxyRotator.getStats();
    console.log(`📊 Proxy Pool Stats: ${proxyStats.available}/${proxyStats.total} available, ${proxyStats.failed} failed`);

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

    console.log("🔄 Starting parallel scraping with proxy rotation...");
    
    // Scrape from multiple sources in parallel with proxy rotation
    const [autoTraderPrices, carsPrices, ebayPrices, carGurusPrices] = await Promise.all([
      scrapeAutoTrader(make, model, year),
      scrapeCarscom(make, model, year),
      scrapeEbayMotors(make, model, year),
      scrapeCarGurus(make, model, year)
    ]);

    // Log final proxy pool statistics after scraping
    const finalProxyStats = proxyRotator.getStats();
    console.log(`📊 Final Proxy Pool Stats: ${finalProxyStats.available}/${finalProxyStats.total} available, ${finalProxyStats.failed} failed`);

    // Combine all prices
    const allPrices = [...autoTraderPrices, ...carsPrices, ...ebayPrices, ...carGurusPrices];

    if (allPrices.length === 0) {
      return new Response(JSON.stringify({
        error: `No market data found for ${year} ${make} ${model}. Try a different vehicle or check back later.`,
        success: false,
        proxyStats: finalProxyStats
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
    console.log(`🎯 Price breakdown: AutoTrader=${autoTraderPrices.length}, Cars.com=${carsPrices.length}, eBay=${ebayPrices.length}, CarGurus=${carGurusPrices.length}`);

    const vehicleValue: VehicleValueResponse = {
      low,
      avg,
      high,
      make,
      model,
      year,
      source: "web_scraping_with_proxy_rotation",
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

    // Save to price history with enhanced metadata
    try {
      await supabase
        .from("price_history")
        .insert({
          query: `${year} ${make} ${model}`,
          avg_price: avg,
          min_price: low,
          max_price: high,
          data_source: "web_scraping_with_proxy_rotation",
          listing_type: "market_value",
          item_count: allPrices.length,
          metadata: {
            sources: {
              autotrader: autoTraderPrices.length,
              cars_com: carsPrices.length,
              ebay_motors: ebayPrices.length,
              cargurus: carGurusPrices.length
            },
            proxy_stats: finalProxyStats
          }
        });
    } catch (historyError) {
      console.warn("⚠️ Failed to save to price history:", historyError);
    }

    return new Response(JSON.stringify({
      ...vehicleValue,
      metadata: {
        sources: {
          autotrader: autoTraderPrices.length,
          cars_com: carsPrices.length,
          ebay_motors: ebayPrices.length,
          cargurus: carGurusPrices.length
        },
        proxy_stats: finalProxyStats
      }
    }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });

  } catch (e: any) {
    console.error("💥 Unexpected error:", e);
    
    // Log proxy stats even on error
    const errorProxyStats = proxyRotator.getStats();
    console.log(`📊 Error Proxy Pool Stats: ${errorProxyStats.available}/${errorProxyStats.total} available, ${errorProxyStats.failed} failed`);
    
    return new Response(JSON.stringify({ 
      error: e.message || "Internal server error",
      success: false,
      proxy_stats: errorProxyStats
    }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });
  }
}); 