import { createClient } from '@supabase/supabase-js';
import { SavedItem, PriceHistory, SearchFilters, ItemSummary } from '../types';
import { SubscriptionData } from './stripe';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});

// Auth Types
export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  preferred_location?: string;
  notification_preferences: {
    email_alerts: boolean;
    price_drops: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface SignUpData {
  email: string;
  password: string;
  fullName?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface ResetPasswordData {
  email: string;
}

export interface UpdatePasswordData {
  password: string;
}

// Enhanced price history interface for 30-day tracking
export interface DailyPricePoint {
  day: string;
  low_price: number;
  high_price: number;
  avg_price: number;
  data_points: number;
}

// Vehicle value interfaces
export interface VehicleValueRequest {
  make: string;
  model: string;
  year: number;
  mileage?: number;
  trim?: string;
  zipCode?: string;
}

export interface VehicleValueResponse {
  low?: number;
  avg?: number;
  high?: number;
  value?: number; // For backward compatibility with old API response
  currency: string;
  make: string;
  model: string;
  year: number;
  source: string;
  timestamp: string;
  cached?: boolean;
  success: boolean;
}

export interface VehicleHistoryPoint {
  day: string;
  avg_value: number;
  data_points: number;
}

// Simple market value cache - load from localStorage on module load
const marketValueCache = JSON.parse(localStorage.getItem('pricepilot_vehicle_cache') || '{}');

// Simple cache cleanup - remove expired entries
const cleanupCache = () => {
  const now = Date.now();
  const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours
  let cleaned = 0;
  
  for (const key in marketValueCache) {
    if (marketValueCache[key].timestamp && (now - marketValueCache[key].timestamp) >= CACHE_DURATION) {
      delete marketValueCache[key];
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} expired vehicle values from cache`);
    localStorage.setItem('pricepilot_vehicle_cache', JSON.stringify(marketValueCache));
  }
};

// Clean cache on load and every 30 minutes
cleanupCache();
setInterval(cleanupCache, 30 * 60 * 1000);

// Master function that checks cache first, only scrapes on miss
async function fetchVehicleValue({ make, model, year, mileage, trim, zipCode }: VehicleValueRequest): Promise<VehicleValueResponse> {
  const key = [
    make.toLowerCase(),
    model.toLowerCase().replace(/\s+/g, '-'),
    year
  ].join('|');

  // 1) First check cache
  if (marketValueCache[key]) {
    const cached = marketValueCache[key];
    const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours
    
    if (cached.timestamp && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log(`📋 Cache HIT for ${key}`);
      return { ...cached.data, cached: true };
    } else {
      // Cache expired, remove it
      delete marketValueCache[key];
    }
  }

  // 2) Only log & scrape on a cache miss
  console.log(`🚗 Cache MISS — fetching vehicle value for: ${make} ${model} ${year}`);
  
  // Perform the actual scrape
  const { data, error } = await supabase.functions.invoke('scrape-vehicle-market-value', {
    body: { make, model, year, mileage, trim, zipCode }
  });

  if (error) {
    console.error(`❌ Vehicle market value error for ${key}:`, error);
    throw new Error(error.message || 'Failed to get vehicle market value');
  }

  if (!data.success) {
    throw new Error(data.error || 'Vehicle market value lookup failed');
  }

  console.log(`✅ Vehicle market value SUCCESS for ${key}:`, data);
  
  // 3) Store back into both in-memory cache and localStorage
  marketValueCache[key] = {
    data: data as VehicleValueResponse,
    timestamp: Date.now()
  };
  localStorage.setItem('pricepilot_vehicle_cache', JSON.stringify(marketValueCache));

  return data as VehicleValueResponse;
}

// Vehicle Value Functions - New Scraping Approach with Enhanced Caching
export async function getVehicleMarketValue(request: VehicleValueRequest): Promise<VehicleValueResponse> {
  try {
    return await fetchVehicleValue(request);
  } catch (error) {
    console.error('💥 Error getting vehicle market value:', error);
    throw error;
  }
}

// Legacy function for backward compatibility
export async function getVehicleValue(request: VehicleValueRequest): Promise<VehicleValueResponse> {
  try {
    const scrapingResult = await fetchVehicleValue(request);
    
    // Convert scraping result to legacy format for backward compatibility
    return {
      ...scrapingResult,
      value: scrapingResult.avg || 0 // Use avg as the single value for legacy compatibility
    };
  } catch (error) {
    console.error('💥 Vehicle value lookup failed:', error);
    throw error;
  }
}

export async function getVehicleHistory(make: string, model: string, year: number, days: number = 30): Promise<VehicleHistoryPoint[]> {
  try {
    console.log(`📊 Fetching vehicle history for ${year} ${make} ${model} (${days} days)`);

    const { data, error } = await supabase.rpc('get_vehicle_value_history', {
      p_make: make,
      p_model: model,
      p_year: year,
      p_days: days
    });

    if (error) {
      console.error('❌ Vehicle history error:', error);
      throw error;
    }

    console.log('✅ Vehicle history response:', data);
    
    return (data || []).map((item: any) => ({
      day: item.day,
      avg_value: parseFloat(item.avg_value) || 0,
      data_points: parseInt(item.data_points) || 0
    }));

  } catch (error) {
    console.error('💥 Error getting vehicle history:', error);
    throw error;
  }
}

// Helper function to extract vehicle info from search query
export function parseVehicleFromQuery(query: string): Partial<VehicleValueRequest> | null {
  try {
    console.log('🔍 Parsing vehicle from query:', query);
    
    // Basic regex patterns to extract make, model, year
    const yearMatch = query.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? parseInt(yearMatch[0]) : undefined;

    // Common car makes (extend this list as needed)
    const makes = [
      'Audi', 'BMW', 'Mercedes-Benz', 'Mercedes', 'Ford', 'Chevrolet', 'Toyota', 'Honda', 'Nissan',
      'Volkswagen', 'Hyundai', 'Subaru', 'Mazda', 'Volvo', 'Lexus', 'Acura',
      'Infiniti', 'Cadillac', 'Lincoln', 'Jeep', 'Dodge', 'Chrysler', 'Ram',
      'GMC', 'Buick', 'Pontiac', 'Oldsmobile', 'Saturn', 'Saab', 'Jaguar',
      'Land Rover', 'Range Rover', 'Porsche', 'Ferrari', 'Lamborghini', 'Bentley',
      'Rolls Royce', 'Aston Martin', 'McLaren', 'Lotus', 'Maserati', 'Alfa Romeo'
    ];

    let make: string | undefined;
    let model: string | undefined;

    // Find make in query - prioritize longer matches (Mercedes-Benz over Mercedes)
    const sortedMakes = makes.sort((a, b) => b.length - a.length);
    for (const m of sortedMakes) {
      const regex = new RegExp(`\\b${m.replace('-', '\\-')}\\b`, 'i');
      if (regex.test(query)) {
        make = m;
        break;
      }
    }

    console.log('🔍 Found make:', make, 'year:', year);

    if (make && year) {
      const makeIndex = query.toLowerCase().indexOf(make.toLowerCase());
      const yearIndex = query.indexOf(year.toString());
      
      let modelPart = '';
      
      // Handle both cases: year before make (1967 Ford Mustang) and make before year (Ford 2025 F-150)
      if (yearIndex < makeIndex) {
        // Year comes before make: "1967 Ford Mustang"
        // Model is everything after make, limited to reasonable length
        modelPart = query.substring(makeIndex + make.length).trim();
      } else {
        // Make comes before year: "Ford 2025 F-150"
        // Model is everything after make, before year
        modelPart = query.substring(makeIndex + make.length, yearIndex).trim();
      }
      
      // Clean up model name - preserve hyphens and alphanumeric, remove common words
      model = modelPart
        .replace(/\b(for sale|used|new|car|auto|vehicle|truck|great|driving|convertible|crate|motor|reupholstered|extra|parts|included|see|video)\b/gi, '')
        .replace(/[^\w\s-]/g, ' ') // Replace non-alphanumeric except hyphens and spaces
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .slice(0, 3) // Limit to first 3 words for model
        .join(' ');
      
      // Special handling for Mercedes-Benz models
      if (make === 'Mercedes-Benz' && model.startsWith('-Benz')) {
        model = model.replace('-Benz', '').trim();
      }
      
      console.log('🔍 Extracted model part:', modelPart, '-> cleaned:', model);
      
      if (model && model.length > 0) {
        const result = { make, model, year };
        console.log('✅ Successfully parsed vehicle:', result);
        return result;
      }
    }

    console.log('❌ Could not parse vehicle from query');
    return null;
  } catch (error) {
    console.error('Error parsing vehicle from query:', error);
    return null;
  }
}

// Debug function to check cache stats
export function getVehicleCacheStats() {
  return {
    cacheSize: Object.keys(marketValueCache).length,
    cacheKeys: Object.keys(marketValueCache)
  };
}

// Debug function to check what's in the price history table
export async function debugPriceHistory() {
  try {
    console.log('🔍 Debugging price history data...');

    // Check what's in the price_history table
    const { data: allHistory, error: historyError } = await supabase
      .from('price_history')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10);

    if (historyError) {
      console.error('❌ Error fetching price history:', historyError);
    } else {
      console.log('📊 Recent price history entries:', allHistory);
    }

    // Check what's in saved_items
    const { data: savedItems, error: itemsError } = await supabase
      .from('saved_items')
      .select('id, title, search_query, item_type, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (itemsError) {
      console.error('❌ Error fetching saved items:', itemsError);
    } else {
      console.log('💾 Recent saved items:', savedItems);
    }

    // Test RPC function with a sample saved item ID
    if (savedItems && savedItems.length > 0) {
      const sampleItem = savedItems[0];
      console.log(`🧪 Testing RPC with item: ${sampleItem.id} (${sampleItem.title || sampleItem.search_query})`);

      const { data: rpcData, error: rpcError } = await supabase.rpc('get_30d_price_history_by_saved_item', {
        p_saved_item_id: sampleItem.id
      });

      if (rpcError) {
        console.error('❌ RPC error:', rpcError);
      } else {
        console.log('📈 RPC result:', rpcData);
      }

      // Also test the query-based RPC
      if (sampleItem.title || sampleItem.search_query) {
        const query = sampleItem.title || sampleItem.search_query;
        const { data: queryRpcData, error: queryRpcError } = await supabase.rpc('get_30d_price_history_by_query', {
          p_query: query
        });

        if (queryRpcError) {
          console.error('❌ Query RPC error:', queryRpcError);
        } else {
          console.log('📈 Query RPC result:', queryRpcData);
        }
      }
    }

    return {
      priceHistory: allHistory,
      savedItems: savedItems,
      message: 'Debug info logged to console'
    };

  } catch (error) {
    console.error('💥 Debug function error:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Authentication Functions
export async function signUp({ email, password, fullName }: SignUpData) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: undefined, // Disable email confirmation
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signIn({ email, password }: SignInData) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    throw error;
  }
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    throw error;
  }
  
  return user;
}

export async function getProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data;
}

export async function updateProfile(updates: Partial<Profile>) {
  const { data: user } = await supabase.auth.getUser();
  
  if (!user.user) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.user.id);

  if (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
}

// Unified Saved Items Functions
export async function getAllSavedItems(): Promise<SavedItem[]> {
  const { data, error } = await supabase
    .from('saved_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching saved items:', error);
    throw error;
  }

  return data || [];
}

export async function saveIndividualItem(item: ItemSummary, priceAlertThreshold?: number): Promise<void> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('User must be logged in to save items');
  }

  const { error } = await supabase
    .from('saved_items')
    .insert({
      user_id: user.id, // Add user_id for RLS policy
      item_type: 'item',
      item_id: item.itemId,
      title: item.title,
      price: item.price.value,
      currency: item.price.currency,
      image_url: item.image?.imageUrl,
      item_url: item.itemWebUrl,
      condition: item.condition,
      seller_username: item.seller?.username,
      seller_feedback_score: item.seller?.feedbackScore,
      seller_feedback_percentage: item.seller?.feedbackPercentage,
      shipping_cost: item.shippingOptions?.[0]?.shippingCost?.value,
      shipping_currency: item.shippingOptions?.[0]?.shippingCost?.currency,
      buying_options: item.buyingOptions,
      price_alert_threshold: priceAlertThreshold,
    });

  if (error) {
    console.error('Error saving individual item:', error);
    throw error;
  }
}

export async function updateSavedItem(id: string, updates: Partial<SavedItem>): Promise<void> {
  const { error } = await supabase
    .from('saved_items')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating saved item:', error);
    throw error;
  }
}

export async function deleteSavedItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('saved_items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting saved item:', error);
    throw error;
  }
}

export async function checkIfItemSaved(itemId: string): Promise<boolean> {
  const user = await getCurrentUser();
  
  if (!user) {
    return false;
  }

  const { data, error } = await supabase
    .from('saved_items')
    .select('id')
    .eq('item_type', 'item')
    .eq('item_id', itemId)
    .eq('user_id', user.id)
    .limit(1);

  if (error) {
    console.error('Error checking if item is saved:', error);
    return false;
  }

  return (data?.length || 0) > 0;
}

// Enhanced Price History Functions
export async function getPriceHistory(query: string): Promise<PriceHistory[]> {
  const { data, error } = await supabase
    .from('price_history')
    .select('*')
    .eq('query', query)
    .order('timestamp', { ascending: true })
    .limit(30);

  if (error) {
    console.error('Error fetching price history:', error);
    throw error;
  }

  return data || [];
}

export async function get30DayPriceHistory(searchId?: string, query?: string): Promise<DailyPricePoint[]> {
  try {
    let result;
    
    if (searchId) {
      console.log('Fetching 30-day history by search ID:', searchId);
      result = await supabase.rpc('get_30d_price_history_by_saved_item', { 
        p_saved_item_id: searchId 
      });
    } else if (query) {
      console.log('Fetching 30-day history by query:', query);
      result = await supabase.rpc('get_30d_price_history_by_query', { 
        p_query: query 
      });
    } else {
      throw new Error('Either searchId or query must be provided');
    }

    if (result.error) {
      console.error('RPC Error details:', result.error);
      throw result.error;
    }

    console.log('30-day price history result:', result);

    return (result.data || []).map((item: any) => ({
      day: item.day,
      low_price: parseFloat(item.low_price) || 0,
      high_price: parseFloat(item.high_price) || 0,
      avg_price: parseFloat(item.avg_price) || 0,
      data_points: parseInt(item.data_points) || 0
    }));
  } catch (error) {
    console.error('Error in get30DayPriceHistory:', error);
    throw error;
  }
}

export async function savePriceHistory(
  query: string,
  avgPrice: number,
  searchId?: string,
  minPrice?: number,
  maxPrice?: number
): Promise<void> {
  const insertData: any = {
    query,
    avg_price: avgPrice,
  };

  if (searchId) {
    insertData.search_id = searchId;
  }

  if (minPrice !== undefined) {
    insertData.min_price = minPrice;
  }

  if (maxPrice !== undefined) {
    insertData.max_price = maxPrice;
  }

  // Also set the individual price field for compatibility
  insertData.price = avgPrice;

  const { error } = await supabase
    .from('price_history')
    .insert(insertData);

  if (error) {
    console.error('Error saving price history:', error);
    throw error;
  }
}

export async function resetPassword({ email }: ResetPasswordData) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function updatePassword({ password }: UpdatePasswordData) {
  const { data, error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    throw error;
  }

  return data;
}

// Stripe Integration Functions
export async function getUserSubscription(): Promise<SubscriptionData | null> {
  const { data, error } = await supabase
    .from('stripe_user_subscriptions')
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Error fetching subscription:', error);
    throw error;
  }

  return data;
}

export async function getUserOrders() {
  const { data, error } = await supabase
    .from('stripe_user_orders')
    .select('*')
    .order('order_date', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }

  return data || [];
}

// Test function to manually trigger price alerts
export async function triggerPriceAlertsManually(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('🧪 Triggering price alerts manually...');

    // Check environment variables
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing environment variables:', { 
        hasUrl: !!supabaseUrl, 
        hasAnonKey: !!supabaseAnonKey 
      });
      return { 
        success: false, 
        message: 'Environment variables not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' 
      };
    }

    const functionUrl = `${supabaseUrl}/functions/v1/check-price-alerts`;
    console.log('📡 Function URL:', functionUrl);
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      return { 
        success: false, 
        message: 'Authentication required to trigger price alerts. Please sign in first.' 
      };
    }

    console.log('🔑 Authentication token available, making request...');

    // Try using Supabase client first (handles auth and CORS better)
    try {
      console.log('📡 Attempting to invoke via Supabase client...');
      
      const { data, error } = await supabase.functions.invoke('check-price-alerts', {
        body: { 
          trigger: 'manual',
          timestamp: new Date().toISOString()
        }
      });

      if (error) {
        console.error('❌ Supabase client error:', error);
        throw error;
      }

      console.log('✅ Supabase client success:', data);
      return { 
        success: true, 
        message: data?.message || 'Price alerts check completed successfully! Check your email if any price drops were found.' 
      };
      
    } catch (supabaseError) {
      console.error('❌ Supabase client failed, falling back to direct fetch...', supabaseError);
      
      // Fallback to direct fetch request
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          trigger: 'manual',
          timestamp: new Date().toISOString()
        }),
      });

      console.log('📥 Fetch response status:', response.status, response.statusText);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
          console.error('❌ Response error data:', errorData);
        } catch (parseError) {
          console.error('❌ Could not parse error response');
          try {
            const errorText = await response.text();
            console.error('❌ Error response text:', errorText);
            if (errorText) {
              errorMessage = errorText;
            }
          } catch (textError) {
            console.error('❌ Could not get error response text');
          }
        }
        
        return { 
          success: false, 
          message: `Request failed: ${errorMessage}` 
        };
      }

      const data = await response.json();
      console.log('✅ Fetch success response:', data);
      
      return { 
        success: true, 
        message: data?.message || 'Price alerts check completed successfully! Check your email if any price drops were found.' 
      };
    }
    
  } catch (error) {
    console.error('💥 Error triggering price alerts:', error);
    
    // Provide specific error messages
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      return { 
        success: false, 
        message: 'Network error: Unable to connect to the Edge Function. Please ensure the function is deployed and accessible.' 
      };
    }
    
    return { 
      success: false, 
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}` 
    };
  }
}