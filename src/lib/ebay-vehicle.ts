import { supabase } from './supabase';

// Enhanced logging for debugging
function logEnvironmentInfo() {
  console.log('🌐 [Environment] Browser environment info:');
  console.log('   - User Agent:', navigator.userAgent);
  console.log('   - Online:', navigator.onLine);
  console.log('   - Language:', navigator.language);
  console.log('   - Platform:', navigator.platform);
  console.log('   - Cookie Enabled:', navigator.cookieEnabled);
  console.log('   - Current URL:', window.location.href);
  console.log('   - VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
  console.log('   - VITE_SUPABASE_ANON_KEY exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
  console.log('   - Timestamp:', new Date().toISOString());
}

// Call environment logging on module load
logEnvironmentInfo();

export interface VehicleAspect {
  value: string;
  displayName: string;
  count: number;
  make?: string; // For models, to associate with specific makes
}

export interface VehicleAspects {
  makes: VehicleAspect[];
  models: VehicleAspect[];
  years: VehicleAspect[];
}

// Cache for vehicle aspects with filter keys
const aspectsCache = new Map<string, { data: VehicleAspects; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for real-time data

// Generate cache key from filters
function getCacheKey(make?: string, model?: string): string {
  return `${make || 'no-make'}-${model || 'no-model'}`;
}

// Enhanced cascading vehicle aspects function
export async function getVehicleAspects(make?: string, model?: string): Promise<VehicleAspects> {
  console.log('🚀 [getVehicleAspects] Starting cascading vehicle aspects fetch...', { make, model });
  
  const cacheKey = getCacheKey(make, model);
  const cached = aspectsCache.get(cacheKey);
  
  // Return cached data if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('📋 [getVehicleAspects] Returning cached vehicle aspects for:', cacheKey);
    console.log('   - Cache age:', Math.round((Date.now() - cached.timestamp) / 1000), 'seconds');
    return cached.data;
  }

  try {
    console.log('🔄 [getVehicleAspects] Cache expired/empty, fetching fresh data for:', cacheKey);
    
    console.log('🔐 [getVehicleAspects] Getting Supabase session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ [getVehicleAspects] Session error:', sessionError);
      throw new Error(`Session error: ${sessionError.message}`);
    }
    
    if (!session?.access_token) {
      console.error('❌ [getVehicleAspects] No session or access token found');
      console.log('   - Session exists:', !!session);
      console.log('   - Access token exists:', !!session?.access_token);
      throw new Error('Authentication required');
    }
    
    console.log('✅ [getVehicleAspects] Session validated');
    console.log('   - User ID:', session.user?.id);
    console.log('   - Token prefix:', session.access_token.slice(0, 20), '...');
    
    // Build query parameters for cascading filters
    const params = new URLSearchParams();
    if (make) {
      params.append('make', make);
      console.log(`   - Added make filter: "${make}"`);
    }
    if (model) {
      params.append('model', model);
      console.log(`   - Added model filter: "${model}"`);
    }
    
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebay-vehicle-aspects`;
    const fullUrl = params.toString() ? `${functionUrl}?${params.toString()}` : functionUrl;
    
    console.log('🌐 [getVehicleAspects] Making cascading request to:', fullUrl);
    console.log('   - Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('   - Anon key prefix:', import.meta.env.VITE_SUPABASE_ANON_KEY?.slice(0, 20), '...');

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({}),
    });

    console.log('📨 [getVehicleAspects] Response received:');
    console.log('   - Status:', response.status, response.statusText);
    console.log('   - Headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [getVehicleAspects] Vehicle API error:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText
      });
      throw new Error(`Failed to fetch vehicle aspects: ${response.status} - ${errorText}`);
    }

    console.log('📋 [getVehicleAspects] Parsing JSON response...');
    const data = await response.json();
    console.log('✅ [getVehicleAspects] JSON parsed successfully');
    console.log('   - Raw data keys:', Object.keys(data));
    console.log('   - Makes count:', data.makes?.length || 0);
    console.log('   - Models count:', data.models?.length || 0);
    console.log('   - Years count:', data.years?.length || 0);
    
    // Log what we're getting back based on current filter state
    if (!make && !model) {
      console.log('📊 [getVehicleAspects] Initial load - all aspects available');
    } else if (make && !model) {
      console.log(`📊 [getVehicleAspects] Filtered by make "${make}" - models available`);
    } else if (make && model) {
      console.log(`📊 [getVehicleAspects] Filtered by make "${make}" and model "${model}" - years available`);
    }
    
    // Log sample data for debugging
    if (data.makes?.length > 0) {
      console.log('   - Sample makes:', data.makes.slice(0, 3).map((m: any) => `${m.displayName}(${m.count})`));
    }
    if (data.models?.length > 0) {
      console.log('   - Sample models:', data.models.slice(0, 3).map((m: any) => `${m.displayName}(${m.count})`));
    }
    if (data.years?.length > 0) {
      console.log('   - Sample years:', data.years.slice(0, 3).map((y: any) => `${y.displayName}(${y.count})`));
    }
    
    // Validate the data structure
    if (!data.makes && !data.models && !data.years) {
      console.error('❌ [getVehicleAspects] No vehicle data returned:', {
        makesExists: !!data.makes,
        modelsExists: !!data.models, 
        yearsExists: !!data.years,
        dataKeys: Object.keys(data)
      });
      throw new Error('No vehicle aspects data returned from API');
    }
    
    console.log('🔍 [getVehicleAspects] Processing cascading response data...');
    // Ensure we always have arrays for the structure
    const filteredData = {
      makes: data.makes || [],
      models: data.models || [],
      years: data.years || []
    };
    
    console.log('✅ [getVehicleAspects] Cascading data processed successfully:');
    console.log('   - Makes:', filteredData.makes.length);
    console.log('   - Models:', filteredData.models.length); 
    console.log('   - Years:', filteredData.years.length);
    
    // Cache the results with filter-specific key
    console.log('💾 [getVehicleAspects] Caching results for key:', cacheKey);
    aspectsCache.set(cacheKey, {
      data: filteredData,
      timestamp: Date.now()
    });
    
    console.log('🎉 [getVehicleAspects] Success! Returning cascading data');
    return filteredData;
  } catch (error) {
    console.error('💥 [getVehicleAspects] Error in cascading getVehicleAspects:', {
      errorType: error?.constructor?.name,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      filters: { make, model }
    });
    
    // Throw the error instead of using fallback data
    throw new Error(`Failed to fetch vehicle data from eBay: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Get models for a specific make (now uses cascading API)
export async function getModelsForMake(make: string): Promise<VehicleAspect[]> {
  console.log(`🔍 [getModelsForMake] Getting models for make: "${make}" via cascading API`);
  
  if (!make) {
    console.log('   - No make specified, returning empty array');
    return [];
  }
  
  try {
    // Use the cascading API to get models for the specific make
    const vehicleAspects = await getVehicleAspects(make);
    const models = vehicleAspects.models;
    
    console.log(`✅ [getModelsForMake] Found ${models.length} models for make: ${make} (via cascading API)`);
    
    if (models.length > 0) {
      console.log('   - Sample models:', models.slice(0, 3).map(m => `${m.displayName}(${m.count})`));
    }
    
    return models;
  } catch (error) {
    console.error(`❌ [getModelsForMake] Error getting models for make ${make}:`, error);
    throw error;
  }
}

// Get years for a specific make and model (now uses cascading API)
export async function getYearsForMakeModel(make: string, model: string): Promise<VehicleAspect[]> {
  console.log(`🔍 [getYearsForMakeModel] Getting years for make: "${make}", model: "${model}" via cascading API`);
  
  if (!make || !model) {
    console.log('   - Make or model not specified, returning empty array');
    return [];
  }
  
  try {
    // Use the cascading API to get years for the specific make+model
    const vehicleAspects = await getVehicleAspects(make, model);
    const years = vehicleAspects.years;
    
    console.log(`✅ [getYearsForMakeModel] Found ${years.length} years for ${make} ${model} (via cascading API)`);
    
    if (years.length > 0) {
      console.log('   - Sample years:', years.slice(0, 3).map(y => `${y.displayName}(${y.count})`));
    }
    
    return years;
  } catch (error) {
    console.error(`❌ [getYearsForMakeModel] Error getting years for ${make} ${model}:`, error);
    throw error;
  }
}

// Clear the cache
export function clearVehicleAspectsCache(): void {
  console.log('🗑️ [clearVehicleAspectsCache] Clearing vehicle aspects cache');
  console.log('   - Previous cache size:', aspectsCache.size);
  
  aspectsCache.clear();
  
  console.log('✅ [clearVehicleAspectsCache] Vehicle aspects cache cleared');
}

// Force refresh the cache for specific filters
export async function refreshVehicleAspects(make?: string, model?: string): Promise<VehicleAspects> {
  console.log('🔄 [refreshVehicleAspects] Force refreshing vehicle aspects...', { make, model });
  
  // Clear cache entry for this specific filter combination
  const cacheKey = getCacheKey(make, model);
  aspectsCache.delete(cacheKey);
  console.log('   - Cleared cache for key:', cacheKey);
  
  try {
    const result = await getVehicleAspects(make, model);
    console.log('✅ [refreshVehicleAspects] Refresh completed successfully');
    return result;
  } catch (error) {
    console.error('❌ [refreshVehicleAspects] Refresh failed:', error);
    throw error;
  }
}