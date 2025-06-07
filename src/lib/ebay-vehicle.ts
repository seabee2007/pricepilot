import { supabase } from './supabase';
import { VehicleAspects, VehicleAspect, CompatibilityProperty } from '../types';

// Cache for vehicle aspects to avoid repeated API calls
let aspectsCache: VehicleAspects | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export async function getVehicleAspects(): Promise<VehicleAspects> {
  // Return cached data if still valid
  if (aspectsCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
    console.log('Returning cached vehicle aspects');
    return aspectsCache;
  }

  try {
    console.log('Fetching fresh vehicle aspects from Taxonomy API...');
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
      console.error('Vehicle aspects API error:', errorText);
      throw new Error(`Failed to fetch vehicle aspects: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Received vehicle aspects:', {
      makes: data.makes?.length || 0,
      models: data.models?.length || 0,
      years: data.years?.length || 0,
      properties: data.compatibilityProperties?.length || 0
    });
    
    // Validate the data structure
    if (!data.makes || !data.models || !data.years || !data.compatibilityProperties) {
      throw new Error('Invalid vehicle aspects data structure');
    }
    
    // Filter out any items with zero counts and ensure proper structure
    const filteredData: VehicleAspects = {
      makes: data.makes.filter((make: VehicleAspect) => make.count > 0),
      models: data.models.filter((model: VehicleAspect) => model.count > 0),
      years: data.years.filter((year: VehicleAspect) => year.count > 0),
      compatibilityProperties: data.compatibilityProperties || []
    };
    
    console.log('Filtered vehicle aspects:', {
      makes: filteredData.makes.length,
      models: filteredData.models.length,
      years: filteredData.years.length,
      properties: filteredData.compatibilityProperties.length
    });
    
    // Cache the results
    aspectsCache = filteredData;
    cacheTimestamp = Date.now();
    
    return filteredData;
  } catch (error) {
    console.error('Error fetching vehicle aspects:', error);
    
    // Return fallback data if API fails
    console.log('Using fallback vehicle aspects due to API error');
    const fallbackData = getFallbackVehicleAspects();
    
    // Cache fallback data for a shorter time (5 minutes)
    aspectsCache = fallbackData;
    cacheTimestamp = Date.now() - (CACHE_DURATION - 5 * 60 * 1000);
    
    return fallbackData;
  }
}

// Get compatibility properties for a category
export async function getCompatibilityProperties(categoryId: string = '6001'): Promise<CompatibilityProperty[]> {
  try {
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
      body: JSON.stringify({
        action: 'getProperties',
        categoryId
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Compatibility properties API error:', errorText);
      throw new Error(`Failed to fetch compatibility properties: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.compatibilityProperties || [];
  } catch (error) {
    console.error('Error fetching compatibility properties:', error);
    return [
      { name: 'Year', localizedName: 'Year' },
      { name: 'Make', localizedName: 'Make' },
      { name: 'Model', localizedName: 'Model' },
      { name: 'Trim', localizedName: 'Trim' },
      { name: 'Engine', localizedName: 'Engine' }
    ];
  }
}

// Get property values with progressive filtering
export async function getPropertyValues(
  property: string,
  categoryId: string = '6001',
  filters?: { [key: string]: string }
): Promise<VehicleAspect[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Authentication required');
    }

    // Build filter string for Taxonomy API
    let filterString = '';
    if (filters && Object.keys(filters).length > 0) {
      filterString = Object.entries(filters)
        .map(([key, value]) => `${key}:${value}`)
        .join(',');
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebay-vehicle-aspects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'getPropertyValues',
        categoryId,
        compatibilityProperty: property,
        filters: filterString
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Property values API error:', errorText);
      throw new Error(`Failed to fetch property values: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.values || [];
  } catch (error) {
    console.error(`Error fetching ${property} values:`, error);
    return [];
  }
}

// Get models for a specific make using Taxonomy API
export async function getModelsForMake(make: string, year?: string): Promise<VehicleAspect[]> {
  const filters: { [key: string]: string } = { Make: make };
  if (year) {
    filters.Year = year;
  }
  
  return getPropertyValues('Model', '6001', filters);
}

// Get trims for specific make/model/year
export async function getTrimsForVehicle(
  make: string, 
  model: string, 
  year?: string
): Promise<VehicleAspect[]> {
  const filters: { [key: string]: string } = { 
    Make: make, 
    Model: model 
  };
  if (year) {
    filters.Year = year;
  }
  
  return getPropertyValues('Trim', '6001', filters);
}

// Get engines for specific make/model/year/trim
export async function getEnginesForVehicle(
  make: string, 
  model: string, 
  year?: string,
  trim?: string
): Promise<VehicleAspect[]> {
  const filters: { [key: string]: string } = { 
    Make: make, 
    Model: model 
  };
  if (year) filters.Year = year;
  if (trim) filters.Trim = trim;
  
  return getPropertyValues('Engine', '6001', filters);
}

// Get models for a specific make from cached data (fallback)
export function getModelsForMakeFromCache(vehicleAspects: VehicleAspects, make: string): VehicleAspect[] {
  if (!make) {
    return vehicleAspects.models;
  }
  
  // Filter models that are associated with the selected make
  const makeModels = vehicleAspects.models.filter(model => 
    model.make === make || !model.make // Include generic models if no make specified
  );
  
  console.log(`Found ${makeModels.length} models for make: ${make}`);
  
  // If no specific models found for this make, return top generic models
  if (makeModels.length === 0) {
    console.log(`No specific models found for ${make}, returning top generic models`);
    return vehicleAspects.models.slice(0, 20);
  }
  
  return makeModels;
}

// Enhanced fallback vehicle data with comprehensive model coverage
function getFallbackVehicleAspects(): VehicleAspects {
  const currentYear = new Date().getFullYear();
  const years: VehicleAspect[] = [];
  
  // Generate years from current year back to 1990 with realistic counts
  for (let year = currentYear; year >= 1990; year--) {
    years.push({
      value: year.toString(),
      displayName: year.toString(),
      count: 100
    });
  }

  return {
    compatibilityProperties: [
      { name: 'Year', localizedName: 'Year' },
      { name: 'Make', localizedName: 'Make' },
      { name: 'Model', localizedName: 'Model' },
      { name: 'Trim', localizedName: 'Trim' },
      { name: 'Engine', localizedName: 'Engine' }
    ],
    makes: [
      { value: 'Ford', displayName: 'Ford', count: 15420 },
      { value: 'Chevrolet', displayName: 'Chevrolet', count: 12850 },
      { value: 'Toyota', displayName: 'Toyota', count: 11200 },
      { value: 'Honda', displayName: 'Honda', count: 9800 },
      { value: 'Nissan', displayName: 'Nissan', count: 8500 },
      { value: 'BMW', displayName: 'BMW', count: 7200 },
      { value: 'Mercedes-Benz', displayName: 'Mercedes-Benz', count: 6800 },
      { value: 'Audi', displayName: 'Audi', count: 5900 },
      { value: 'Dodge', displayName: 'Dodge', count: 5600 },
      { value: 'Jeep', displayName: 'Jeep', count: 5200 },
      { value: 'GMC', displayName: 'GMC', count: 4800 },
      { value: 'Hyundai', displayName: 'Hyundai', count: 4500 },
      { value: 'Kia', displayName: 'Kia', count: 4200 },
      { value: 'Subaru', displayName: 'Subaru', count: 3900 },
      { value: 'Mazda', displayName: 'Mazda', count: 3600 },
      { value: 'Volkswagen', displayName: 'Volkswagen', count: 3400 },
      { value: 'Lexus', displayName: 'Lexus', count: 3200 },
      { value: 'Cadillac', displayName: 'Cadillac', count: 2800 },
      { value: 'Buick', displayName: 'Buick', count: 2500 },
      { value: 'Lincoln', displayName: 'Lincoln', count: 2200 }
    ],
    models: [
      { value: 'F-150', displayName: 'F-150', count: 2500, make: 'Ford' },
      { value: 'Mustang', displayName: 'Mustang', count: 900, make: 'Ford' },
      { value: 'Camry', displayName: 'Camry', count: 1200, make: 'Toyota' },
      { value: 'Civic', displayName: 'Civic', count: 1100, make: 'Honda' },
      { value: 'Silverado', displayName: 'Silverado', count: 1800, make: 'Chevrolet' }
    ],
    years
  };
}

export function clearVehicleAspectsCache(): void {
  aspectsCache = null;
  cacheTimestamp = 0;
  console.log('Vehicle aspects cache cleared');
}

export async function refreshVehicleAspects(): Promise<VehicleAspects> {
  clearVehicleAspectsCache();
  return getVehicleAspects();
}