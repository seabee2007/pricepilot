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
    
    // Return fallback data if API fails
    console.log('Using fallback vehicle aspects due to API error');
    const fallbackData = getFallbackVehicleAspects();
    
    // Cache fallback data for a shorter time (1 minute)
    aspectsCache = fallbackData;
    cacheTimestamp = Date.now() - (CACHE_DURATION - 1 * 60 * 1000);
    
    return fallbackData;
  }
}

// Get models for a specific make
export function getModelsForMake(vehicleAspects: VehicleAspects, make: string): VehicleAspect[] {
  if (!make) {
    return vehicleAspects.models;
  }
  
  // Filter models that are associated with the selected make
  const makeModels = vehicleAspects.models.filter(model => 
    model.make === make
  );
  
  console.log(`Found ${makeModels.length} models for make: ${make}`);
  
  // If no specific models found for this make, check if we're using real API data vs fallback
  if (makeModels.length === 0) {
    console.log(`No specific models found for ${make}`);
    
    // If we have very few models compared to makes, it suggests the API didn't return make-specific models
    // In this case, return common models for popular makes as a fallback
    if (vehicleAspects.models.length < 100 && vehicleAspects.makes.length > 200) {
      console.log(`API data appears incomplete (${vehicleAspects.models.length} models vs ${vehicleAspects.makes.length} makes). Using common models for ${make}.`);
      return getCommonModelsForMake(make);
    }
    
    return [];
  }
  
  return makeModels;
}

// Get common models for popular makes (enhanced fallback)
function getCommonModelsForMake(make: string): VehicleAspect[] {
  const commonModels: { [key: string]: VehicleAspect[] } = {
    'Ford': [
      { value: 'F-150', displayName: 'F-150', count: 3500, make: 'Ford' },
      { value: 'Mustang', displayName: 'Mustang', count: 1900, make: 'Ford' },
      { value: 'Explorer', displayName: 'Explorer', count: 1650, make: 'Ford' },
      { value: 'Escape', displayName: 'Escape', count: 1580, make: 'Ford' },
      { value: 'Focus', displayName: 'Focus', count: 1520, make: 'Ford' },
      { value: 'Fusion', displayName: 'Fusion', count: 1480, make: 'Ford' },
      { value: 'Edge', displayName: 'Edge', count: 1420, make: 'Ford' },
      { value: 'Expedition', displayName: 'Expedition', count: 1380, make: 'Ford' },
      { value: 'F-250', displayName: 'F-250', count: 1350, make: 'Ford' },
      { value: 'Ranger', displayName: 'Ranger', count: 1320, make: 'Ford' }
    ],
    'Chevrolet': [
      { value: 'Silverado', displayName: 'Silverado', count: 3200, make: 'Chevrolet' },
      { value: 'Camaro', displayName: 'Camaro', count: 1600, make: 'Chevrolet' },
      { value: 'Corvette', displayName: 'Corvette', count: 1200, make: 'Chevrolet' },
      { value: 'Equinox', displayName: 'Equinox', count: 1550, make: 'Chevrolet' },
      { value: 'Malibu', displayName: 'Malibu', count: 1480, make: 'Chevrolet' },
      { value: 'Tahoe', displayName: 'Tahoe', count: 1420, make: 'Chevrolet' },
      { value: 'Suburban', displayName: 'Suburban', count: 1380, make: 'Chevrolet' },
      { value: 'Cruze', displayName: 'Cruze', count: 1350, make: 'Chevrolet' },
      { value: 'Traverse', displayName: 'Traverse', count: 1320, make: 'Chevrolet' },
      { value: 'Impala', displayName: 'Impala', count: 1280, make: 'Chevrolet' }
    ],
    'Toyota': [
      { value: 'Camry', displayName: 'Camry', count: 2800, make: 'Toyota' },
      { value: 'Corolla', displayName: 'Corolla', count: 1800, make: 'Toyota' },
      { value: 'RAV4', displayName: 'RAV4', count: 1950, make: 'Toyota' },
      { value: 'Prius', displayName: 'Prius', count: 1680, make: 'Toyota' },
      { value: 'Highlander', displayName: 'Highlander', count: 1580, make: 'Toyota' },
      { value: 'Tacoma', displayName: 'Tacoma', count: 1520, make: 'Toyota' },
      { value: 'Sienna', displayName: 'Sienna', count: 1380, make: 'Toyota' },
      { value: 'Tundra', displayName: 'Tundra', count: 1350, make: 'Toyota' },
      { value: '4Runner', displayName: '4Runner', count: 1320, make: 'Toyota' },
      { value: 'Avalon', displayName: 'Avalon', count: 1280, make: 'Toyota' }
    ],
    'Honda': [
      { value: 'Accord', displayName: 'Accord', count: 2600, make: 'Honda' },
      { value: 'Civic', displayName: 'Civic', count: 2400, make: 'Honda' },
      { value: 'CR-V', displayName: 'CR-V', count: 1580, make: 'Honda' },
      { value: 'Pilot', displayName: 'Pilot', count: 1520, make: 'Honda' },
      { value: 'Odyssey', displayName: 'Odyssey', count: 1420, make: 'Honda' },
      { value: 'Fit', displayName: 'Fit', count: 1380, make: 'Honda' },
      { value: 'HR-V', displayName: 'HR-V', count: 1320, make: 'Honda' },
      { value: 'Ridgeline', displayName: 'Ridgeline', count: 1280, make: 'Honda' },
      { value: 'Passport', displayName: 'Passport', count: 1220, make: 'Honda' },
      { value: 'Insight', displayName: 'Insight', count: 1180, make: 'Honda' }
    ],
    'Nissan': [
      { value: 'Altima', displayName: 'Altima', count: 1650, make: 'Nissan' },
      { value: 'Sentra', displayName: 'Sentra', count: 1420, make: 'Nissan' },
      { value: 'Rogue', displayName: 'Rogue', count: 1580, make: 'Nissan' },
      { value: 'Pathfinder', displayName: 'Pathfinder', count: 1380, make: 'Nissan' },
      { value: 'Maxima', displayName: 'Maxima', count: 1320, make: 'Nissan' },
      { value: 'Murano', displayName: 'Murano', count: 1280, make: 'Nissan' },
      { value: 'Frontier', displayName: 'Frontier', count: 1250, make: 'Nissan' },
      { value: 'Titan', displayName: 'Titan', count: 1220, make: 'Nissan' },
      { value: 'Armada', displayName: 'Armada', count: 1180, make: 'Nissan' },
      { value: 'Versa', displayName: 'Versa', count: 1150, make: 'Nissan' }
    ],
    'BMW': [
      { value: '3 Series', displayName: '3 Series', count: 1800, make: 'BMW' },
      { value: '5 Series', displayName: '5 Series', count: 1400, make: 'BMW' },
      { value: 'X3', displayName: 'X3', count: 1300, make: 'BMW' },
      { value: 'X5', displayName: 'X5', count: 1250, make: 'BMW' },
      { value: '7 Series', displayName: '7 Series', count: 1000, make: 'BMW' },
      { value: 'Z4', displayName: 'Z4', count: 800, make: 'BMW' },
      { value: 'i3', displayName: 'i3', count: 600, make: 'BMW' },
      { value: '1 Series', displayName: '1 Series', count: 900, make: 'BMW' },
      { value: 'X1', displayName: 'X1', count: 1100, make: 'BMW' },
      { value: 'M3', displayName: 'M3', count: 700, make: 'BMW' }
    ],
    'Mercedes-Benz': [
      { value: 'C-Class', displayName: 'C-Class', count: 1600, make: 'Mercedes-Benz' },
      { value: 'E-Class', displayName: 'E-Class', count: 1400, make: 'Mercedes-Benz' },
      { value: 'S-Class', displayName: 'S-Class', count: 1000, make: 'Mercedes-Benz' },
      { value: 'GLE', displayName: 'GLE', count: 1200, make: 'Mercedes-Benz' },
      { value: 'GLC', displayName: 'GLC', count: 1300, make: 'Mercedes-Benz' },
      { value: 'A-Class', displayName: 'A-Class', count: 900, make: 'Mercedes-Benz' },
      { value: 'CLA', displayName: 'CLA', count: 800, make: 'Mercedes-Benz' },
      { value: 'GLB', displayName: 'GLB', count: 700, make: 'Mercedes-Benz' },
      { value: 'GLS', displayName: 'GLS', count: 600, make: 'Mercedes-Benz' },
      { value: 'AMG GT', displayName: 'AMG GT', count: 400, make: 'Mercedes-Benz' }
    ],
    'Audi': [
      { value: 'A4', displayName: 'A4', count: 1500, make: 'Audi' },
      { value: 'A6', displayName: 'A6', count: 1200, make: 'Audi' },
      { value: 'Q5', displayName: 'Q5', count: 1300, make: 'Audi' },
      { value: 'Q7', displayName: 'Q7', count: 1000, make: 'Audi' },
      { value: 'A3', displayName: 'A3', count: 1100, make: 'Audi' },
      { value: 'Q3', displayName: 'Q3', count: 900, make: 'Audi' },
      { value: 'A8', displayName: 'A8', count: 700, make: 'Audi' },
      { value: 'TT', displayName: 'TT', count: 600, make: 'Audi' },
      { value: 'R8', displayName: 'R8', count: 300, make: 'Audi' },
      { value: 'Q8', displayName: 'Q8', count: 800, make: 'Audi' }
    ],
    'Dodge': [
      { value: 'Charger', displayName: 'Charger', count: 1800, make: 'Dodge' },
      { value: 'Challenger', displayName: 'Challenger', count: 1600, make: 'Dodge' },
      { value: 'Durango', displayName: 'Durango', count: 1400, make: 'Dodge' },
      { value: 'Grand Caravan', displayName: 'Grand Caravan', count: 1200, make: 'Dodge' },
      { value: 'Journey', displayName: 'Journey', count: 1000, make: 'Dodge' },
      { value: 'Dart', displayName: 'Dart', count: 800, make: 'Dodge' },
      { value: 'Viper', displayName: 'Viper', count: 300, make: 'Dodge' },
      { value: 'Avenger', displayName: 'Avenger', count: 600, make: 'Dodge' },
      { value: 'Caravan', displayName: 'Caravan', count: 900, make: 'Dodge' },
      { value: 'Nitro', displayName: 'Nitro', count: 400, make: 'Dodge' }
    ],
    'Jeep': [
      { value: 'Wrangler', displayName: 'Wrangler', count: 2000, make: 'Jeep' },
      { value: 'Grand Cherokee', displayName: 'Grand Cherokee', count: 1800, make: 'Jeep' },
      { value: 'Cherokee', displayName: 'Cherokee', count: 1500, make: 'Jeep' },
      { value: 'Compass', displayName: 'Compass', count: 1200, make: 'Jeep' },
      { value: 'Renegade', displayName: 'Renegade', count: 1000, make: 'Jeep' },
      { value: 'Gladiator', displayName: 'Gladiator', count: 800, make: 'Jeep' },
      { value: 'Liberty', displayName: 'Liberty', count: 600, make: 'Jeep' },
      { value: 'Patriot', displayName: 'Patriot', count: 500, make: 'Jeep' },
      { value: 'Commander', displayName: 'Commander', count: 400, make: 'Jeep' },
      { value: 'Wagoneer', displayName: 'Wagoneer', count: 300, make: 'Jeep' }
    ]
  };
  
  const models = commonModels[make] || [];
  console.log(`Returning ${models.length} common models for ${make}`);
  return models;
}

// Fallback vehicle data
function getFallbackVehicleAspects(): VehicleAspects {
  const currentYear = new Date().getFullYear();
  const years: VehicleAspect[] = [];
  
  // Generate years from current year back to 1990
  for (let year = currentYear; year >= 1990; year--) {
    years.push({
      value: year.toString(),
      displayName: year.toString(),
      count: Math.floor(Math.random() * 500 + 100)
    });
  }

  return {
    makes: [
      { value: 'Ford', displayName: 'Ford', count: 25420 },
      { value: 'Chevrolet', displayName: 'Chevrolet', count: 22850 },
      { value: 'Toyota', displayName: 'Toyota', count: 21200 },
      { value: 'Honda', displayName: 'Honda', count: 19800 },
      { value: 'Nissan', displayName: 'Nissan', count: 18500 },
      { value: 'BMW', displayName: 'BMW', count: 17200 },
      { value: 'Mercedes-Benz', displayName: 'Mercedes-Benz', count: 16800 },
      { value: 'Audi', displayName: 'Audi', count: 15900 },
      { value: 'Dodge', displayName: 'Dodge', count: 15600 },
      { value: 'Jeep', displayName: 'Jeep', count: 15200 },
      { value: 'GMC', displayName: 'GMC', count: 14800 },
      { value: 'Hyundai', displayName: 'Hyundai', count: 14500 },
      { value: 'Kia', displayName: 'Kia', count: 14200 },
      { value: 'Subaru', displayName: 'Subaru', count: 13900 },
      { value: 'Mazda', displayName: 'Mazda', count: 13600 }
    ],
    models: [
      // Ford models
      { value: 'F-150', displayName: 'F-150', count: 3500, make: 'Ford' },
      { value: 'Mustang', displayName: 'Mustang', count: 1900, make: 'Ford' },
      { value: 'Explorer', displayName: 'Explorer', count: 1650, make: 'Ford' },
      { value: 'Escape', displayName: 'Escape', count: 1580, make: 'Ford' },
      { value: 'Focus', displayName: 'Focus', count: 1520, make: 'Ford' },
      { value: 'Fusion', displayName: 'Fusion', count: 1480, make: 'Ford' },
      { value: 'Edge', displayName: 'Edge', count: 1420, make: 'Ford' },
      { value: 'Expedition', displayName: 'Expedition', count: 1380, make: 'Ford' },
      { value: 'F-250', displayName: 'F-250', count: 1350, make: 'Ford' },
      { value: 'Ranger', displayName: 'Ranger', count: 1320, make: 'Ford' },
      
      // Chevrolet models
      { value: 'Silverado', displayName: 'Silverado', count: 3200, make: 'Chevrolet' },
      { value: 'Camaro', displayName: 'Camaro', count: 1600, make: 'Chevrolet' },
      { value: 'Corvette', displayName: 'Corvette', count: 1200, make: 'Chevrolet' },
      { value: 'Equinox', displayName: 'Equinox', count: 1550, make: 'Chevrolet' },
      { value: 'Malibu', displayName: 'Malibu', count: 1480, make: 'Chevrolet' },
      { value: 'Tahoe', displayName: 'Tahoe', count: 1420, make: 'Chevrolet' },
      { value: 'Suburban', displayName: 'Suburban', count: 1380, make: 'Chevrolet' },
      { value: 'Cruze', displayName: 'Cruze', count: 1350, make: 'Chevrolet' },
      { value: 'Traverse', displayName: 'Traverse', count: 1320, make: 'Chevrolet' },
      { value: 'Impala', displayName: 'Impala', count: 1280, make: 'Chevrolet' },
      
      // Toyota models
      { value: 'Camry', displayName: 'Camry', count: 2800, make: 'Toyota' },
      { value: 'Corolla', displayName: 'Corolla', count: 1800, make: 'Toyota' },
      { value: 'RAV4', displayName: 'RAV4', count: 1950, make: 'Toyota' },
      { value: 'Prius', displayName: 'Prius', count: 1680, make: 'Toyota' },
      { value: 'Highlander', displayName: 'Highlander', count: 1580, make: 'Toyota' },
      { value: 'Tacoma', displayName: 'Tacoma', count: 1520, make: 'Toyota' },
      { value: 'Sienna', displayName: 'Sienna', count: 1380, make: 'Toyota' },
      { value: 'Tundra', displayName: 'Tundra', count: 1350, make: 'Toyota' },
      { value: '4Runner', displayName: '4Runner', count: 1320, make: 'Toyota' },
      { value: 'Avalon', displayName: 'Avalon', count: 1280, make: 'Toyota' },
      
      // Honda models
      { value: 'Accord', displayName: 'Accord', count: 2600, make: 'Honda' },
      { value: 'Civic', displayName: 'Civic', count: 2400, make: 'Honda' },
      { value: 'CR-V', displayName: 'CR-V', count: 1580, make: 'Honda' },
      { value: 'Pilot', displayName: 'Pilot', count: 1520, make: 'Honda' },
      { value: 'Odyssey', displayName: 'Odyssey', count: 1420, make: 'Honda' },
      { value: 'Fit', displayName: 'Fit', count: 1380, make: 'Honda' },
      { value: 'HR-V', displayName: 'HR-V', count: 1320, make: 'Honda' },
      { value: 'Ridgeline', displayName: 'Ridgeline', count: 1280, make: 'Honda' },
      { value: 'Passport', displayName: 'Passport', count: 1220, make: 'Honda' },
      { value: 'Insight', displayName: 'Insight', count: 1180, make: 'Honda' },
      
      // Nissan models
      { value: 'Altima', displayName: 'Altima', count: 1650, make: 'Nissan' },
      { value: 'Sentra', displayName: 'Sentra', count: 1420, make: 'Nissan' },
      { value: 'Rogue', displayName: 'Rogue', count: 1580, make: 'Nissan' },
      { value: 'Pathfinder', displayName: 'Pathfinder', count: 1380, make: 'Nissan' },
      { value: 'Maxima', displayName: 'Maxima', count: 1320, make: 'Nissan' },
      { value: 'Murano', displayName: 'Murano', count: 1280, make: 'Nissan' },
      { value: 'Frontier', displayName: 'Frontier', count: 1250, make: 'Nissan' },
      { value: 'Titan', displayName: 'Titan', count: 1220, make: 'Nissan' },
      { value: 'Armada', displayName: 'Armada', count: 1180, make: 'Nissan' },
      { value: 'Versa', displayName: 'Versa', count: 1150, make: 'Nissan' }
    ],
    years
  };
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