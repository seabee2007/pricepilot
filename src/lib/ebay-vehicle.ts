import { supabase } from './supabase';

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
  // Return cached data if still valid
  if (aspectsCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
    console.log('Returning cached vehicle aspects');
    return aspectsCache;
  }

  try {
    console.log('Fetching fresh vehicle aspects from eBay Browse API...');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebay-vehicle-aspects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vehicle API error:', errorText);
      throw new Error(`Failed to fetch vehicle aspects: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Received vehicle aspects:', {
      makes: data.makes?.length || 0,
      models: data.models?.length || 0,
      years: data.years?.length || 0
    });
    
    // Validate the data structure
    if (!data.makes || !data.models || !data.years) {
      throw new Error('Invalid vehicle aspects data structure');
    }
    
    // Filter out any items with zero counts
    const filteredData = {
      makes: data.makes.filter((make: VehicleAspect) => make.count > 0),
      models: data.models.filter((model: VehicleAspect) => model.count > 0),
      years: data.years.filter((year: VehicleAspect) => year.count > 0)
    };
    
    console.log('Filtered vehicle aspects:', {
      makes: filteredData.makes.length,
      models: filteredData.models.length,
      years: filteredData.years.length
    });
    
    // Cache the results
    aspectsCache = filteredData;
    cacheTimestamp = Date.now();
    
    return filteredData;
  } catch (error) {
    console.error('Error fetching vehicle aspects:', error);
    
    // Throw the error instead of using fallback data
    throw new Error(`Failed to fetch vehicle data from eBay: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Get models for a specific make
export function getModelsForMake(vehicleAspects: VehicleAspects, make: string): VehicleAspect[] {
  if (!make) {
    return vehicleAspects.models;
  }
  
  // Filter models that are associated with the selected make (ONLY real eBay data)
  const makeModels = vehicleAspects.models.filter(model => 
    model.make === make
  );
  
  console.log(`Found ${makeModels.length} models for make: ${make} (eBay data only)`);
  
  return makeModels;
}

// Clear the cache
export function clearVehicleAspectsCache(): void {
  aspectsCache = null;
  cacheTimestamp = 0;
  console.log('Vehicle aspects cache cleared');
}

// Force refresh the cache
export async function refreshVehicleAspects(): Promise<VehicleAspects> {
  clearVehicleAspectsCache();
  return await getVehicleAspects();
}