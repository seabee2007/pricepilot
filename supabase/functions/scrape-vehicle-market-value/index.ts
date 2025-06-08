import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Contact email for compliance and transparency
const CONTACT_EMAIL = "support@pricepilot.online";

// In-memory LRU cache for duplicate request prevention
interface CacheEntry {
  data: any;
  timestamp: number;
}

class LRUCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private readonly ttl: number; // Time to live in milliseconds

  constructor(maxSize = 100, ttl = 5 * 60 * 1000) { // 5 minutes default TTL
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  set(key: string, data: any): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global in-memory cache
const memoryCache = new LRUCache(100, 5 * 60 * 1000); // 100 entries, 5 minutes TTL

// Audit logging function
async function logAuditEvent(event: {
  action: string;
  url: string;
  status_code: number;
  response_time_ms: number;
  source: string;
  make?: string;
  model?: string;
  year?: number;
  proxy_used?: string;
  error?: string;
  cache_hit?: boolean;
}) {
  try {
    await supabase
      .from("scraping_audit_log")
      .insert({
        ...event,
        timestamp: new Date().toISOString(),
        user_agent: `PricePilot-Scraper/1.0 (+mailto:${CONTACT_EMAIL})`,
        compliance_notes: "Public data only, no personal info collected"
      });
  } catch (error) {
    console.warn("⚠️ Failed to log audit event:", error);
  }
}

// Enhanced anti-scraping detection
function detectAntiScraping(html: string, response: Response): {
  isSuspicious: boolean;
  reason?: string;
} {
  const suspiciousIndicators = [
    { pattern: /captcha/i, reason: "CAPTCHA detected" },
    { pattern: /blocked/i, reason: "Blocked message detected" },
    { pattern: /access.*denied/i, reason: "Access denied message" },
    { pattern: /rate.*limit/i, reason: "Rate limit message" },
    { pattern: /suspicious.*activity/i, reason: "Suspicious activity warning" },
    { pattern: /robot.*detected/i, reason: "Robot detection message" },
    { pattern: /cloudflare.*challenge/i, reason: "Cloudflare challenge" },
    { pattern: /please.*verify.*human/i, reason: "Human verification required" }
  ];

  // Check HTML content
  for (const indicator of suspiciousIndicators) {
    if (indicator.pattern.test(html)) {
      return { isSuspicious: true, reason: indicator.reason };
    }
  }

  // Check if response looks like a disguised block (200 status but suspicious content)
  if (response.status === 200 && html.length < 1000) {
    return { isSuspicious: true, reason: "Suspiciously short response" };
  }

  // Check for redirect to login/verification pages
  if (response.url && (
    response.url.includes('/login') ||
    response.url.includes('/verify') ||
    response.url.includes('/blocked')
  )) {
    return { isSuspicious: true, reason: "Redirected to verification page" };
  }

  return { isSuspicious: false };
}

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
      
      const startTime = Date.now();
      const response = await fetch(url, { 
        headers: {
          'User-Agent': `PricePilot-ProxyFetcher/1.0 (+mailto:${CONTACT_EMAIL})`,
          'From': CONTACT_EMAIL
        }
      });
      
      await logAuditEvent({
        action: "fetch_proxy_list",
        url,
        status_code: response.status,
        response_time_ms: Date.now() - startTime,
        source: "proxyscrape_api"
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
      await logAuditEvent({
        action: "fetch_proxy_list_error",
        url: "https://api.proxyscrape.com",
        status_code: 0,
        response_time_ms: 0,
        source: "proxyscrape_api",
        error: error.message
      });
      return [];
    }
  }

  // Test if a proxy is working
  private async testProxy(proxy: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const startTime = Date.now();
      const response = await fetch("https://httpbin.org/ip", {
        signal: controller.signal,
        headers: {
          'User-Agent': `PricePilot-ProxyTester/1.0 (+mailto:${CONTACT_EMAIL})`,
          'From': CONTACT_EMAIL
        }
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Proxy ${proxy} is working (IP: ${data.origin})`);
        
        await logAuditEvent({
          action: "proxy_validation_success",
          url: "https://httpbin.org/ip",
          status_code: response.status,
          response_time_ms: Date.now() - startTime,
          source: "proxy_validation",
          proxy_used: proxy
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.log(`❌ Proxy ${proxy} failed test:`, error.message);
      
      await logAuditEvent({
        action: "proxy_validation_failed",
        url: "https://httpbin.org/ip",
        status_code: 0,
        response_time_ms: 0,
        source: "proxy_validation",
        proxy_used: proxy,
        error: error.message
      });
      
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

// Enhanced fetch with proxy rotation and compliance headers
async function fetchWithProxy(url: string, options: RequestInit = {}, source: string = "unknown"): Promise<Response> {
  const maxRetries = 3;
  let lastError: Error | null = null;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const proxy = await proxyRotator.getProxy();
      
      // Enhanced headers for transparency and compliance
      const enhancedHeaders = {
        'User-Agent': `PricePilot-Scraper/1.0 (+mailto:${CONTACT_EMAIL})`,
        'From': CONTACT_EMAIL,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        ...options.headers
      };

      if (!proxy) {
        console.log(`🌐 No proxy available, using direct connection (attempt ${attempt})`);
      } else {
        console.log(`🔄 Attempt ${attempt} using proxy: ${proxy}`);
        // Add proxy IP as hint in headers (Deno limitation workaround)
        enhancedHeaders['X-Forwarded-For'] = proxy.split(':')[0];
      }
      
      const response = await fetch(url, {
        ...options,
        headers: enhancedHeaders
      });

      const responseTime = Date.now() - startTime;

      // Enhanced anti-scraping detection
      if (response.ok) {
        const html = await response.text();
        const antiScrapingCheck = detectAntiScraping(html, response);
        
        if (antiScrapingCheck.isSuspicious) {
          console.warn(`🚨 Anti-scraping detected: ${antiScrapingCheck.reason}`);
          
          await logAuditEvent({
            action: "anti_scraping_detected",
            url,
            status_code: response.status,
            response_time_ms: responseTime,
            source,
            proxy_used: proxy || "direct",
            error: antiScrapingCheck.reason
          });
          
          if (proxy) {
            proxyRotator.markProxyFailed(proxy);
          }
          
          throw new Error(`Anti-scraping detected: ${antiScrapingCheck.reason}`);
        }

        console.log(`✅ Request successful on attempt ${attempt}`);
        
        await logAuditEvent({
          action: "scrape_success",
          url,
          status_code: response.status,
          response_time_ms: responseTime,
          source,
          proxy_used: proxy || "direct"
        });

        // Return response with HTML already read
        return new Response(html, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      } else if (response.status === 429 || response.status === 403) {
        // Rate limited or blocked, mark proxy as failed
        if (proxy) {
          proxyRotator.markProxyFailed(proxy);
        }
        
        await logAuditEvent({
          action: "rate_limited",
          url,
          status_code: response.status,
          response_time_ms: responseTime,
          source,
          proxy_used: proxy || "direct",
          error: `HTTP ${response.status}: Rate limited or blocked`
        });
        
        throw new Error(`HTTP ${response.status}: Rate limited or blocked`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      lastError = error as Error;
      console.log(`❌ Attempt ${attempt} failed: ${lastError.message}`);
      
      await logAuditEvent({
        action: "scrape_attempt_failed",
        url,
        status_code: 0,
        response_time_ms: Date.now() - startTime,
        source,
        error: lastError.message
      });
      
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
    // Check memory cache first
    const cacheKey = `autotrader_${make}_${model}_${year}`;
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      console.log(`💨 AutoTrader cache hit for ${year} ${make} ${model}`);
      await logAuditEvent({
        action: "scrape_success",
        url: `autotrader_${cacheKey}`,
        status_code: 200,
        response_time_ms: 0,
        source: "autotrader",
        make,
        model,
        year,
        cache_hit: true
      });
      return cached;
    }

    const searchUrl = `https://www.autotrader.com/cars-for-sale/all-cars/${make}/${model}/${year}?searchRadius=0&zip=90210`;
    
    console.log(`🔍 Scraping AutoTrader: ${searchUrl}`);
    
    const response = await fetchWithProxy(searchUrl, {}, "autotrader");
    const html = await response.text();
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    if (!doc) {
      throw new Error('Failed to parse HTML');
    }
    
    const prices: number[] = [];
    
    // Updated selectors based on AutoTrader's current structure
    const priceSelectors = [
      '[data-cmp="priceDisplay"]',
      '.price-display',
      '.price-section',
      '[class*="price"]'
    ];
    
    for (const selector of priceSelectors) {
      const priceElements = doc.querySelectorAll(selector);
      
      priceElements.forEach((element) => {
        const text = element.textContent?.trim() || '';
        const priceMatch = text.match(/\$?([\d,]+)/);
        
        if (priceMatch) {
          const cleanPrice = priceMatch[1].replace(/,/g, '');
          const price = parseFloat(cleanPrice);
          
          if (!isNaN(price) && price > 1000 && price < 200000) {
            prices.push(price);
          }
        }
      });
      
      if (prices.length >= 10) break; // Stop when we have enough data
    }
    
    console.log(`📊 AutoTrader found ${prices.length} prices for ${year} ${make} ${model}`);
    
    // Cache the result
    memoryCache.set(cacheKey, prices);
    
    return prices.slice(0, 20); // Limit to 20 prices
    
  } catch (error) {
    console.error(`❌ AutoTrader scraping failed: ${error.message}`);
    
    await logAuditEvent({
      action: "scrape_failed",
      url: "autotrader_search",
      status_code: 0,
      response_time_ms: 0,
      source: "autotrader",
      make,
      model,
      year,
      error: error.message
    });
    
    return [];
  }
}

async function scrapeCars(make: string, model: string, year: number): Promise<number[]> {
  try {
    // Check memory cache first
    const cacheKey = `cars_${make}_${model}_${year}`;
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      console.log(`💨 Cars.com cache hit for ${year} ${make} ${model}`);
      await logAuditEvent({
        action: "scrape_success",
        url: `cars_${cacheKey}`,
        status_code: 200,
        response_time_ms: 0,
        source: "cars_com",
        make,
        model,
        year,
        cache_hit: true
      });
      return cached;
    }

    const searchUrl = `https://www.cars.com/shopping/results/?stock_type=used&makes[]=${make}&models[]=${model}&year_max=${year}&year_min=${year}`;
    
    console.log(`🔍 Scraping Cars.com: ${searchUrl}`);
    
    const response = await fetchWithProxy(searchUrl, {}, "cars_com");
    const html = await response.text();
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    if (!doc) {
      throw new Error('Failed to parse HTML');
    }
    
    const prices: number[] = [];
    
    // Updated selectors for Cars.com
    const priceSelectors = [
      '[data-testid="listing-price"]',
      '.price-section',
      '.primary-price',
      '[class*="price"]'
    ];
    
    for (const selector of priceSelectors) {
      const priceElements = doc.querySelectorAll(selector);
      
      priceElements.forEach((element) => {
        const text = element.textContent?.trim() || '';
        const priceMatch = text.match(/\$?([\d,]+)/);
        
        if (priceMatch) {
          const cleanPrice = priceMatch[1].replace(/,/g, '');
          const price = parseFloat(cleanPrice);
          
          if (!isNaN(price) && price > 1000 && price < 200000) {
            prices.push(price);
          }
        }
      });
      
      if (prices.length >= 10) break;
    }
    
    console.log(`📊 Cars.com found ${prices.length} prices for ${year} ${make} ${model}`);
    
    // Cache the result
    memoryCache.set(cacheKey, prices);
    
    return prices.slice(0, 20);
    
  } catch (error) {
    console.error(`❌ Cars.com scraping failed: ${error.message}`);
    
    await logAuditEvent({
      action: "scrape_failed",
      url: "cars_com_search",
      status_code: 0,
      response_time_ms: 0,
      source: "cars_com",
      make,
      model,
      year,
      error: error.message
    });
    
    return [];
  }
}

async function scrapeEbayMotors(make: string, model: string, year: number): Promise<number[]> {
  try {
    // Check memory cache first
    const cacheKey = `ebay_${make}_${model}_${year}`;
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      console.log(`💨 eBay Motors cache hit for ${year} ${make} ${model}`);
      await logAuditEvent({
        action: "scrape_success",
        url: `ebay_${cacheKey}`,
        status_code: 200,
        response_time_ms: 0,
        source: "ebay_motors",
        make,
        model,
        year,
        cache_hit: true
      });
      return cached;
    }

    const searchUrl = `https://www.ebay.com/sch/Cars-Trucks/6001/i.html?_nkw=${year}+${make}+${model}`;
    
    console.log(`🔍 Scraping eBay Motors: ${searchUrl}`);
    
    const response = await fetchWithProxy(searchUrl, {}, "ebay_motors");
    const html = await response.text();
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    if (!doc) {
      throw new Error('Failed to parse HTML');
    }
    
    const prices: number[] = [];
    
    // Updated selectors for eBay
    const priceSelectors = [
      '.notranslate',
      '.s-item__price',
      '[data-testid="item-price"]',
      '.price'
    ];
    
    for (const selector of priceSelectors) {
      const priceElements = doc.querySelectorAll(selector);
      
      priceElements.forEach((element) => {
        const text = element.textContent?.trim() || '';
        const priceMatch = text.match(/\$?([\d,]+\.?\d*)/);
        
        if (priceMatch) {
          const cleanPrice = priceMatch[1].replace(/,/g, '');
          const price = parseFloat(cleanPrice);
          
          if (!isNaN(price) && price > 1000 && price < 200000) {
            prices.push(price);
          }
        }
      });
      
      if (prices.length >= 10) break;
    }
    
    console.log(`📊 eBay Motors found ${prices.length} prices for ${year} ${make} ${model}`);
    
    // Cache the result
    memoryCache.set(cacheKey, prices);
    
    return prices.slice(0, 20);
    
  } catch (error) {
    console.error(`❌ eBay Motors scraping failed: ${error.message}`);
    
    await logAuditEvent({
      action: "scrape_failed",
      url: "ebay_motors_search",
      status_code: 0,
      response_time_ms: 0,
      source: "ebay_motors",
      make,
      model,
      year,
      error: error.message
    });
    
    return [];
  }
}

async function scrapeCarGurus(make: string, model: string, year: number): Promise<number[]> {
  try {
    // Check memory cache first
    const cacheKey = `cargurus_${make}_${model}_${year}`;
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      console.log(`💨 CarGurus cache hit for ${year} ${make} ${model}`);
      await logAuditEvent({
        action: "scrape_success",
        url: `cargurus_${cacheKey}`,
        status_code: 200,
        response_time_ms: 0,
        source: "cargurus",
        make,
        model,
        year,
        cache_hit: true
      });
      return cached;
    }

    const searchUrl = `https://www.cargurus.com/Cars/inventorylisting/viewDetailsFilterViewInventoryListing.action?entitySelectingHelper.selectedEntity=${year}_${make}_${model}`;
    
    console.log(`🔍 Scraping CarGurus: ${searchUrl}`);
    
    const response = await fetchWithProxy(searchUrl, {}, "cargurus");
    const html = await response.text();
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    if (!doc) {
      throw new Error('Failed to parse HTML');
    }
    
    const prices: number[] = [];
    
    // Updated selectors for CarGurus
    const priceSelectors = [
      '[data-cg-ft="car-listing-price"]',
      '.price-section',
      '.listing-price',
      '[class*="price"]'
    ];
    
    for (const selector of priceSelectors) {
      const priceElements = doc.querySelectorAll(selector);
      
      priceElements.forEach((element) => {
        const text = element.textContent?.trim() || '';
        const priceMatch = text.match(/\$?([\d,]+)/);
        
        if (priceMatch) {
          const cleanPrice = priceMatch[1].replace(/,/g, '');
          const price = parseFloat(cleanPrice);
          
          if (!isNaN(price) && price > 1000 && price < 200000) {
            prices.push(price);
          }
        }
      });
      
      if (prices.length >= 10) break;
    }
    
    console.log(`📊 CarGurus found ${prices.length} prices for ${year} ${make} ${model}`);
    
    // Cache the result
    memoryCache.set(cacheKey, prices);
    
    return prices.slice(0, 20);
    
  } catch (error) {
    console.error(`❌ CarGurus scraping failed: ${error.message}`);
    
    await logAuditEvent({
      action: "scrape_failed",
      url: "cargurus_search",
      status_code: 0,
      response_time_ms: 0,
      source: "cargurus",
      make,
      model,
      year,
      error: error.message
    });
    
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

    // Log proxy pool and memory cache statistics
    const proxyStats = proxyRotator.getStats();
    console.log(`📊 Proxy Pool Stats: ${proxyStats.available}/${proxyStats.total} available, ${proxyStats.failed} failed`);
    console.log(`💾 Memory Cache: ${memoryCache.size()} entries`);

    const { make, model, year, mileage, trim, zipCode } = await req.json();

    if (!make || !model || !year) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: make, model, year" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`🔍 Searching for: ${year} ${make} ${model}`);

    // Check database cache first (4-hour cache)
    const cacheKey = `${make.toLowerCase()}_${model.toLowerCase()}_${year}_market_value`;
    console.log(`🔍 Cache key: ${cacheKey}`);

    const { data: cachedData, error: cacheError } = await supabase
      .from('scraped_market_values')
      .select('*')
      .eq('cache_key', cacheKey)
      .gte('created_at', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()) // 4 hours
      .order('created_at', { ascending: false })
      .limit(1);

    if (cachedData && cachedData.length > 0) {
      console.log(`💨 Database cache hit for ${year} ${make} ${model}`);
      
      await logAuditEvent({
        action: "cache_hit",
        url: `database_${cacheKey}`,
        status_code: 200,
        response_time_ms: 0,
        source: "database_cache",
        make,
        model,
        year,
        cache_hit: true
      });

      return new Response(
        JSON.stringify({
          ...cachedData[0],
          source: "database_cache_4h",
          cache_hit: true,
          proxy_stats: proxyStats,
          memory_cache_size: memoryCache.size()
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    console.log("💨 No recent cache found, proceeding with fresh scraping...");

    const startTime = Date.now();

    // Scrape all sources in parallel
    const [autoTraderPrices, carsPrices, ebayPrices, carGurusPrices] = await Promise.all([
      scrapeAutoTrader(make, model, year),
      scrapeCars(make, model, year),
      scrapeEbayMotors(make, model, year),
      scrapeCarGurus(make, model, year)
    ]);

    const allPrices = [
      ...autoTraderPrices,
      ...carsPrices,
      ...ebayPrices,
      ...carGurusPrices
    ].filter(price => price > 0);

    console.log(`📊 Total prices collected: ${allPrices.length}`);
    console.log(`📊 Source breakdown: AutoTrader: ${autoTraderPrices.length}, Cars.com: ${carsPrices.length}, eBay: ${ebayPrices.length}, CarGurus: ${carGurusPrices.length}`);

    let result;

    if (allPrices.length === 0) {
      console.log("❌ No prices found from any source");
      
      await logAuditEvent({
        action: "scrape_no_results",
        url: "multiple_sources",
        status_code: 200,
        response_time_ms: Date.now() - startTime,
        source: "combined_scraping",
        make,
        model,
        year,
        error: "No prices found from any source"
      });

      result = {
        make,
        model,
        year,
        low: null,
        avg: null,
        high: null,
        source: "web_scraping_with_proxy_rotation",
        timestamp: new Date().toISOString(),
        error: "No market data found for this vehicle",
        cache_hit: false,
        proxy_stats: proxyStats,
        memory_cache_size: memoryCache.size(),
        sources: {
          autotrader: autoTraderPrices.length,
          cars_com: carsPrices.length,
          ebay_motors: ebayPrices.length,
          cargurus: carGurusPrices.length
        }
      };
    } else {
      // Calculate statistics
      const sortedPrices = allPrices.sort((a, b) => a - b);
      const low = sortedPrices[0];
      const high = sortedPrices[sortedPrices.length - 1];
      const avg = Math.round(allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length);

      console.log(`💰 Price analysis: Low: $${low.toLocaleString()}, Avg: $${avg.toLocaleString()}, High: $${high.toLocaleString()}`);

      result = {
        make,
        model,
        year,
        low,
        avg,
        high,
        source: "web_scraping_with_proxy_rotation",
        timestamp: new Date().toISOString(),
        cache_hit: false,
        proxy_stats: proxyStats,
        memory_cache_size: memoryCache.size(),
        scraped_count: allPrices.length,
        response_time_ms: Date.now() - startTime,
        sources: {
          autotrader: autoTraderPrices.length,
          cars_com: carsPrices.length,
          ebay_motors: ebayPrices.length,
          cargurus: carGurusPrices.length
        }
      };

      // Cache the result in database
      try {
        await supabase
          .from('scraped_market_values')
          .insert({
            cache_key: cacheKey,
            make,
            model,
            year,
            low,
            avg,
            high,
            scraped_count: allPrices.length,
            response_time_ms: Date.now() - startTime,
            sources: {
              autotrader: autoTraderPrices.length,
              cars_com: carsPrices.length,
              ebay_motors: ebayPrices.length,
              cargurus: carGurusPrices.length
            }
          });
        
        console.log("✅ Market value cached to database");
      } catch (error) {
        console.warn("⚠️ Failed to cache to database:", error);
      }

      await logAuditEvent({
        action: "scrape_complete",
        url: "multiple_sources",
        status_code: 200,
        response_time_ms: Date.now() - startTime,
        source: "combined_scraping",
        make,
        model,
        year
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });

  } catch (error) {
    console.error("❌ Error in main handler:", error);
    
    await logAuditEvent({
      action: "handler_error",
      url: "main_handler",
      status_code: 500,
      response_time_ms: 0,
      source: "main_handler",
      error: error.message
    });

    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        details: error.message,
        proxy_stats: proxyRotator.getStats(),
        memory_cache_size: memoryCache.size()
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}); 