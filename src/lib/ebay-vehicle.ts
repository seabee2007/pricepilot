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

// Cache for vehicle aspects
let aspectsCache: VehicleAspects | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for real-time data

export async function getVehicleAspects(): Promise<VehicleAspects> {
  console.log('🚀 [getVehicleAspects] Starting vehicle aspects fetch...');
  
  // Return cached data if still valid
  if (aspectsCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
    console.log('📋 [getVehicleAspects] Returning cached vehicle aspects');
    console.log('   - Cache age:', Math.round((Date.now() - cacheTimestamp) / 1000), 'seconds');
    return aspectsCache;
  }

  try {
    console.log('🔄 [getVehicleAspects] Cache expired/empty, fetching fresh data...');
    console.log('   - Cache timestamp:', cacheTimestamp);
    console.log('   - Current time:', Date.now());
    console.log('   - Cache duration:', CACHE_DURATION);
    
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
    
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebay-vehicle-aspects`;
    console.log('🌐 [getVehicleAspects] Making request to:', functionUrl);
    console.log('   - Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('   - Anon key prefix:', import.meta.env.VITE_SUPABASE_ANON_KEY?.slice(0, 20), '...');

    const response = await fetch(functionUrl, {
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
    
    // Log sample data for debugging
    if (data.makes?.length > 0) {
      console.log('   - Sample makes:', data.makes.slice(0, 3).map((m: any) => `${m.displayName}(${m.count})`));
    }
    if (data.models?.length > 0) {
      console.log('   - Sample models:', data.models.slice(0, 3).map((m: any) => `${m.displayName}(${m.count})`));
    }
    
    // Validate the data structure
    if (!data.makes || !data.models || !data.years) {
      console.error('❌ [getVehicleAspects] Invalid data structure:', {
        makesExists: !!data.makes,
        modelsExists: !!data.models, 
        yearsExists: !!data.years,
        dataKeys: Object.keys(data)
      });
      throw new Error('Invalid vehicle aspects data structure');
    }
    
    console.log('🔍 [getVehicleAspects] Filtering data (removing zero counts)...');
    // Filter out any items with zero counts
    const filteredData = {
      makes: data.makes.filter((make: VehicleAspect) => make.count > 0),
      models: data.models.filter((model: VehicleAspect) => model.count > 0),
      years: data.years.filter((year: VehicleAspect) => year.count > 0)
    };
    
    console.log('✅ [getVehicleAspects] Data filtered successfully:');
    console.log('   - Makes: before', data.makes.length, 'after', filteredData.makes.length);
    console.log('   - Models: before', data.models.length, 'after', filteredData.models.length);
    console.log('   - Years: before', data.years.length, 'after', filteredData.years.length);
    
    // Cache the results
    console.log('💾 [getVehicleAspects] Caching results...');
    aspectsCache = filteredData;
    cacheTimestamp = Date.now();
    console.log('   - Cache timestamp set to:', cacheTimestamp);
    
    console.log('🎉 [getVehicleAspects] Success! Returning filtered data');
    return filteredData;
  } catch (error) {
    console.error('💥 [getVehicleAspects] Error in getVehicleAspects:', {
      errorType: error?.constructor?.name,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    // Throw the error instead of using fallback data
    throw new Error(`Failed to fetch vehicle data from eBay: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Get models for a specific make
export function getModelsForMake(vehicleAspects: VehicleAspects, make: string): VehicleAspect[] {
  console.log(`🔍 [getModelsForMake] Getting models for make: "${make}"`);
  console.log('   - Input aspects:', {
    makes: vehicleAspects.makes.length,
    models: vehicleAspects.models.length,
    years: vehicleAspects.years.length
  });
  
  if (!make) {
    console.log('   - No make specified, returning all models');
    return vehicleAspects.models;
  }
  
  // Filter models that are associated with the selected make (ONLY real eBay data)
  const makeModels = vehicleAspects.models.filter(model => 
    model.make === make
  );
  
  console.log(`✅ [getModelsForMake] Found ${makeModels.length} models for make: ${make} (eBay data only)`);
  
  if (makeModels.length > 0) {
    console.log('   - Sample models:', makeModels.slice(0, 3).map(m => `${m.displayName}(${m.count})`));
  } else {
    console.log('   - Available makes in data:', vehicleAspects.makes.slice(0, 5).map(m => m.value));
    console.log('   - Models with makes:', vehicleAspects.models.filter(m => m.make).slice(0, 5).map(m => `${m.displayName}(${m.make})`));
  }
  
  return makeModels;
}

// Clear the cache
export function clearVehicleAspectsCache(): void {
  console.log('🗑️ [clearVehicleAspectsCache] Clearing vehicle aspects cache');
  console.log('   - Previous cache timestamp:', cacheTimestamp);
  console.log('   - Previous cache data exists:', !!aspectsCache);
  
  aspectsCache = null;
  cacheTimestamp = 0;
  
  console.log('✅ [clearVehicleAspectsCache] Vehicle aspects cache cleared');
}

// Force refresh the cache
export async function refreshVehicleAspects(): Promise<VehicleAspects> {
  console.log('🔄 [refreshVehicleAspects] Force refreshing vehicle aspects...');
  clearVehicleAspectsCache();
  
  try {
    const result = await getVehicleAspects();
    console.log('✅ [refreshVehicleAspects] Refresh completed successfully');
    return result;
  } catch (error) {
    console.error('❌ [refreshVehicleAspects] Refresh failed:', error);
    throw error;
  }
}