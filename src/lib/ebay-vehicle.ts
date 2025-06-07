import { supabase } from './supabase';
import { VehicleAspects, VehicleAspect, CompatibilityProperty } from '../types';

// Cache for vehicle aspects to avoid repeated API calls
let aspectsCache: VehicleAspects | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Get vehicle data using Browse API search results (no Taxonomy API)
export async function getVehicleDataFromBrowseAPI(): Promise<VehicleAspects> {
  console.log('Getting vehicle data from Browse API (no Taxonomy API)...');
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Authentication required');
    }

    // Use eBay Browse API to search for popular vehicles and extract data
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebay-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        query: 'vehicle car truck',
        filters: {
          category: 'motors',
          // Get a broad sample to extract vehicle data
        },
        pageSize: 200, // Get more results to extract vehicle data
        mode: 'live'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Browse API error:', errorText);
      throw new Error(`Failed to fetch vehicle data: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Browse API response received:', data.items?.length || 0, 'vehicles');
    
    // Extract vehicle data from actual eBay listings
    const makes = new Set<string>();
    const models = new Set<string>();
    const years = new Set<string>();
    
    // Parse vehicle data from listing titles and item specifics
    (data.items || []).forEach((item: any) => {
      const title = item.title || '';
      const itemSpecifics = item.localizedAspects || [];
      
      // Extract year from title (look for 4-digit years)
      const yearMatch = title.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        years.add(yearMatch[0]);
      }
      
      // Extract from item specifics if available
      itemSpecifics.forEach((aspect: any) => {
        if (aspect.name === 'Year' && aspect.value) {
          years.add(aspect.value);
        }
        if (aspect.name === 'Make' && aspect.value) {
          makes.add(aspect.value);
        }
        if (aspect.name === 'Model' && aspect.value) {
          models.add(aspect.value);
        }
      });
    });
    
    // Convert sets to arrays and create VehicleAspects structure
    const makesList = Array.from(makes).sort().map(make => ({
      value: make,
      displayName: make,
      count: 100
    }));
    
    const modelsList = Array.from(models).sort().map(model => ({
      value: model,
      displayName: model,
      count: 100
    }));
    
    const yearsList = Array.from(years).sort((a, b) => parseInt(b) - parseInt(a)).map(year => ({
      value: year,
      displayName: year,
      count: 100
    }));
    
    // Merge with fallback data to ensure comprehensive coverage
    const fallbackData = getFallbackVehicleAspects();
    
    const result: VehicleAspects = {
      makes: [...makesList, ...fallbackData.makes].filter((make, index, self) => 
        index === self.findIndex(m => m.value === make.value)
      ).sort((a, b) => a.displayName.localeCompare(b.displayName)),
      models: [...modelsList, ...fallbackData.models].filter((model, index, self) => 
        index === self.findIndex(m => m.value === model.value)
      ).sort((a, b) => a.displayName.localeCompare(b.displayName)),
      years: [...yearsList, ...fallbackData.years].filter((year, index, self) => 
        index === self.findIndex(y => y.value === year.value)
      ).sort((a, b) => parseInt(b.value) - parseInt(a.value)),
      compatibilityProperties: [] // Not needed for Browse API
    };
    
    console.log('Extracted vehicle data from Browse API:', {
      makes: result.makes.length,
      models: result.models.length,
      years: result.years.length
    });
    
    return result;
    
  } catch (error) {
    console.error('Error fetching vehicle data from Browse API:', error);
    console.log('Using fallback vehicle data');
    return getFallbackVehicleAspects();
  }
}

// Main function - use Browse API only
export async function getVehicleAspects(): Promise<VehicleAspects> {
  console.log('Loading vehicle data using Browse API only (no Taxonomy API)...');
  return getVehicleDataFromBrowseAPI();
}

// Get models for a specific make using Browse API (no Taxonomy API)
export async function getModelsForMake(make: string, year?: string): Promise<VehicleAspect[]> {
  console.log(`Getting models for ${make} using Browse API...`);
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Authentication required');
    }

    // Build search query for specific make
    let query = make;
    if (year) {
      query += ` ${year}`;
    }

    // Use eBay Browse API to search for vehicles of this make
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ebay-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        query,
        filters: {
          category: 'motors',
        },
        pageSize: 200, // Get more results to extract model data
        mode: 'live'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Browse API error:', errorText);
      throw new Error(`Failed to fetch models: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`Browse API response for ${make}:`, data.items?.length || 0, 'vehicles');
    
    // Extract models from actual eBay listings
    const models = new Set<string>();
    
    // Parse model data from listing titles and item specifics
    (data.items || []).forEach((item: any) => {
      const title = item.title || '';
      const itemSpecifics = item.localizedAspects || [];
      
      // Extract from item specifics if available
      itemSpecifics.forEach((aspect: any) => {
        if (aspect.name === 'Model' && aspect.value) {
          models.add(aspect.value);
        }
      });
      
      // Also try to extract model from title
      // This is basic pattern matching - could be enhanced
      const titleWords = title.toLowerCase().split(/\s+/);
      const makeIndex = titleWords.findIndex((word: string) => word.includes(make.toLowerCase()));
      if (makeIndex >= 0 && makeIndex < titleWords.length - 1) {
        // Look for potential model name after make
        const potentialModel = titleWords[makeIndex + 1];
        if (potentialModel && potentialModel.length > 1) {
          models.add(potentialModel.charAt(0).toUpperCase() + potentialModel.slice(1));
        }
      }
    });
    
    // Convert to VehicleAspect format
    const modelsList = Array.from(models)
      .filter(model => model.length > 1) // Filter out single characters
      .sort()
      .map(model => ({
        value: model,
        displayName: model,
        count: 100,
        make
      }));
    
    console.log(`Found ${modelsList.length} models for ${make} from Browse API`);
    
    // If we found models, return them, otherwise fallback to common models
    if (modelsList.length > 0) {
      return modelsList;
    } else {
      console.log(`No models found via Browse API for ${make}, using common models`);
      return getCommonModelsForMake(make);
    }
    
  } catch (error) {
    console.error(`Error fetching models for ${make} from Browse API:`, error);
    console.log(`Using common models for ${make} due to API error`);
    return getCommonModelsForMake(make);
  }
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
  
  // If no specific models found for this make, generate some common models for popular makes
  if (makeModels.length === 0) {
    console.log(`No specific models found for ${make}, generating common models`);
    
    // Generate common models for popular makes
    const commonModels = getCommonModelsForMake(make);
    if (commonModels.length > 0) {
      console.log(`Generated ${commonModels.length} common models for ${make}`);
      return commonModels;
    }
    
    // Final fallback to top generic models
    console.log(`No common models available for ${make}, returning top generic models`);
    return vehicleAspects.models.slice(0, 20);
  }
  
  return makeModels;
}

// Generate common models for popular vehicle makes
function getCommonModelsForMake(make: string): VehicleAspect[] {
  const commonModels: { [key: string]: VehicleAspect[] } = {
    'Ford': [
      { value: 'F-150', displayName: 'F-150', count: 2500, make: 'Ford' },
      { value: 'Mustang', displayName: 'Mustang', count: 900, make: 'Ford' },
      { value: 'Explorer', displayName: 'Explorer', count: 800, make: 'Ford' },
      { value: 'Escape', displayName: 'Escape', count: 700, make: 'Ford' },
      { value: 'Fusion', displayName: 'Fusion', count: 600, make: 'Ford' },
      { value: 'F-250', displayName: 'F-250', count: 500, make: 'Ford' },
      { value: 'Edge', displayName: 'Edge', count: 400, make: 'Ford' },
      { value: 'Expedition', displayName: 'Expedition', count: 300, make: 'Ford' }
    ],
    'Chevrolet': [
      { value: 'Silverado', displayName: 'Silverado', count: 1800, make: 'Chevrolet' },
      { value: 'Camaro', displayName: 'Camaro', count: 800, make: 'Chevrolet' },
      { value: 'Equinox', displayName: 'Equinox', count: 700, make: 'Chevrolet' },
      { value: 'Malibu', displayName: 'Malibu', count: 600, make: 'Chevrolet' },
      { value: 'Tahoe', displayName: 'Tahoe', count: 500, make: 'Chevrolet' },
      { value: 'Impala', displayName: 'Impala', count: 400, make: 'Chevrolet' },
      { value: 'Corvette', displayName: 'Corvette', count: 300, make: 'Chevrolet' },
      { value: 'Cruze', displayName: 'Cruze', count: 500, make: 'Chevrolet' }
    ],
    'Toyota': [
      { value: 'Camry', displayName: 'Camry', count: 1200, make: 'Toyota' },
      { value: 'RAV4', displayName: 'RAV4', count: 1000, make: 'Toyota' },
      { value: 'Corolla', displayName: 'Corolla', count: 900, make: 'Toyota' },
      { value: 'Highlander', displayName: 'Highlander', count: 700, make: 'Toyota' },
      { value: 'Prius', displayName: 'Prius', count: 600, make: 'Toyota' },
      { value: 'Tacoma', displayName: 'Tacoma', count: 800, make: 'Toyota' },
      { value: 'Sienna', displayName: 'Sienna', count: 400, make: 'Toyota' },
      { value: '4Runner', displayName: '4Runner', count: 500, make: 'Toyota' }
    ],
    'Honda': [
      { value: 'Civic', displayName: 'Civic', count: 1100, make: 'Honda' },
      { value: 'Accord', displayName: 'Accord', count: 1000, make: 'Honda' },
      { value: 'CR-V', displayName: 'CR-V', count: 900, make: 'Honda' },
      { value: 'Pilot', displayName: 'Pilot', count: 600, make: 'Honda' },
      { value: 'Odyssey', displayName: 'Odyssey', count: 500, make: 'Honda' },
      { value: 'Fit', displayName: 'Fit', count: 400, make: 'Honda' },
      { value: 'Ridgeline', displayName: 'Ridgeline', count: 300, make: 'Honda' },
      { value: 'HR-V', displayName: 'HR-V', count: 350, make: 'Honda' }
    ],
    'Dodge': [
      { value: 'Charger', displayName: 'Charger', count: 800, make: 'Dodge' },
      { value: 'Challenger', displayName: 'Challenger', count: 600, make: 'Dodge' },
      { value: 'Ram 1500', displayName: 'Ram 1500', count: 1200, make: 'Dodge' },
      { value: 'Durango', displayName: 'Durango', count: 500, make: 'Dodge' },
      { value: 'Journey', displayName: 'Journey', count: 400, make: 'Dodge' },
      { value: 'Grand Caravan', displayName: 'Grand Caravan', count: 350, make: 'Dodge' },
      { value: 'Dart', displayName: 'Dart', count: 300, make: 'Dodge' },
      { value: 'Viper', displayName: 'Viper', count: 100, make: 'Dodge' }
    ],
    'BMW': [
      { value: '3 Series', displayName: '3 Series', count: 800, make: 'BMW' },
      { value: '5 Series', displayName: '5 Series', count: 600, make: 'BMW' },
      { value: 'X3', displayName: 'X3', count: 500, make: 'BMW' },
      { value: 'X5', displayName: 'X5', count: 550, make: 'BMW' },
      { value: '7 Series', displayName: '7 Series', count: 300, make: 'BMW' },
      { value: 'Z4', displayName: 'Z4', count: 200, make: 'BMW' },
      { value: 'i3', displayName: 'i3', count: 150, make: 'BMW' },
      { value: '1 Series', displayName: '1 Series', count: 250, make: 'BMW' }
    ]
  };
  
  return commonModels[make] || [];
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