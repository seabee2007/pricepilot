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

// Cache for vehicle aspects to avoid repeated API calls
let aspectsCache: VehicleAspects | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes (shorter for real-time data)

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
      console.error('Vehicle aspects API error:', errorText);
      throw new Error(`Failed to fetch vehicle aspects: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Received real-time vehicle aspects:', {
      makes: data.makes?.length || 0,
      models: data.models?.length || 0,
      years: data.years?.length || 0
    });
    
    // Validate the data structure
    if (!data.makes || !data.models || !data.years) {
      throw new Error('Invalid vehicle aspects data structure');
    }
    
    // Filter out any items with zero counts and ensure proper structure
    const filteredData = {
      makes: data.makes.filter((make: VehicleAspect) => make.count > 0),
      models: data.models.filter((model: VehicleAspect) => model.count > 0),
      years: data.years.filter((year: VehicleAspect) => year.count > 0)
    };
    
    console.log('Filtered real-time vehicle aspects:', {
      makes: filteredData.makes.length,
      models: filteredData.models.length,
      years: filteredData.years.length
    });
    
    // Cache the results with shorter duration for real-time data
    aspectsCache = filteredData;
    cacheTimestamp = Date.now();
    
    return filteredData;
  } catch (error) {
    console.error('Error fetching real-time vehicle aspects:', error);
    
    // Return fallback data if API fails
    console.log('Using fallback vehicle aspects due to API error');
    const fallbackData = getFallbackVehicleAspects();
    
    // Cache fallback data for a shorter time (2 minutes)
    aspectsCache = fallbackData;
    cacheTimestamp = Date.now() - (CACHE_DURATION - 2 * 60 * 1000);
    
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
    // More recent years typically have more listings
    const ageMultiplier = Math.max(0.1, 1 - (currentYear - year) * 0.03);
    const baseCount = Math.floor(Math.random() * 800 + 200);
    const estimatedCount = Math.floor(baseCount * ageMultiplier);
    
    years.push({
      value: year.toString(),
      displayName: year.toString(),
      count: Math.max(10, estimatedCount)
    });
  }

  return {
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
      { value: 'Lincoln', displayName: 'Lincoln', count: 2200 },
      { value: 'Acura', displayName: 'Acura', count: 2000 },
      { value: 'Infiniti', displayName: 'Infiniti', count: 1800 },
      { value: 'Volvo', displayName: 'Volvo', count: 1600 },
      { value: 'Chrysler', displayName: 'Chrysler', count: 1400 },
      { value: 'Ram', displayName: 'Ram', count: 1200 },
      { value: 'Tesla', displayName: 'Tesla', count: 1000 },
      { value: 'Porsche', displayName: 'Porsche', count: 800 },
      { value: 'Mitsubishi', displayName: 'Mitsubishi', count: 600 },
      { value: 'Pontiac', displayName: 'Pontiac', count: 400 },
      { value: 'Land Rover', displayName: 'Land Rover', count: 350 },
      { value: 'Jaguar', displayName: 'Jaguar', count: 300 },
      { value: 'Mini', displayName: 'Mini', count: 280 },
      { value: 'Scion', displayName: 'Scion', count: 250 },
      { value: 'Genesis', displayName: 'Genesis', count: 200 },
      { value: 'Alfa Romeo', displayName: 'Alfa Romeo', count: 150 },
      { value: 'Maserati', displayName: 'Maserati', count: 120 },
      { value: 'Bentley', displayName: 'Bentley', count: 80 },
      { value: 'Ferrari', displayName: 'Ferrari', count: 60 },
      { value: 'Lamborghini', displayName: 'Lamborghini', count: 40 }
    ],
    models: [
      // Ford models - comprehensive list
      { value: 'F-150', displayName: 'F-150', count: 2500, make: 'Ford' },
      { value: 'Mustang', displayName: 'Mustang', count: 900, make: 'Ford' },
      { value: 'Explorer', displayName: 'Explorer', count: 650, make: 'Ford' },
      { value: 'Escape', displayName: 'Escape', count: 580, make: 'Ford' },
      { value: 'Focus', displayName: 'Focus', count: 520, make: 'Ford' },
      { value: 'Fusion', displayName: 'Fusion', count: 480, make: 'Ford' },
      { value: 'Edge', displayName: 'Edge', count: 420, make: 'Ford' },
      { value: 'Expedition', displayName: 'Expedition', count: 380, make: 'Ford' },
      { value: 'F-250', displayName: 'F-250', count: 350, make: 'Ford' },
      { value: 'Ranger', displayName: 'Ranger', count: 320, make: 'Ford' },
      { value: 'Taurus', displayName: 'Taurus', count: 280, make: 'Ford' },
      { value: 'Bronco', displayName: 'Bronco', count: 250, make: 'Ford' },
      { value: 'Transit', displayName: 'Transit', count: 220, make: 'Ford' },
      { value: 'EcoSport', displayName: 'EcoSport', count: 180, make: 'Ford' },
      { value: 'Fiesta', displayName: 'Fiesta', count: 150, make: 'Ford' },
      { value: 'F-350', displayName: 'F-350', count: 280, make: 'Ford' },
      { value: 'Flex', displayName: 'Flex', count: 120, make: 'Ford' },
      { value: 'C-Max', displayName: 'C-Max', count: 100, make: 'Ford' },
      
      // Chevrolet models - comprehensive list
      { value: 'Silverado', displayName: 'Silverado', count: 2200, make: 'Chevrolet' },
      { value: 'Camaro', displayName: 'Camaro', count: 800, make: 'Chevrolet' },
      { value: 'Corvette', displayName: 'Corvette', count: 600, make: 'Chevrolet' },
      { value: 'Equinox', displayName: 'Equinox', count: 550, make: 'Chevrolet' },
      { value: 'Malibu', displayName: 'Malibu', count: 480, make: 'Chevrolet' },
      { value: 'Tahoe', displayName: 'Tahoe', count: 420, make: 'Chevrolet' },
      { value: 'Suburban', displayName: 'Suburban', count: 380, make: 'Chevrolet' },
      { value: 'Cruze', displayName: 'Cruze', count: 350, make: 'Chevrolet' },
      { value: 'Traverse', displayName: 'Traverse', count: 320, make: 'Chevrolet' },
      { value: 'Impala', displayName: 'Impala', count: 280, make: 'Chevrolet' },
      { value: 'Blazer', displayName: 'Blazer', count: 250, make: 'Chevrolet' },
      { value: 'Colorado', displayName: 'Colorado', count: 220, make: 'Chevrolet' },
      { value: 'Trax', displayName: 'Trax', count: 180, make: 'Chevrolet' },
      { value: 'Sonic', displayName: 'Sonic', count: 150, make: 'Chevrolet' },
      { value: 'Spark', displayName: 'Spark', count: 120, make: 'Chevrolet' },
      { value: 'Express', displayName: 'Express', count: 200, make: 'Chevrolet' },
      { value: 'Avalanche', displayName: 'Avalanche', count: 180, make: 'Chevrolet' },
      { value: 'HHR', displayName: 'HHR', count: 100, make: 'Chevrolet' },
      
      // Toyota models - comprehensive list
      { value: 'Camry', displayName: 'Camry', count: 1800, make: 'Toyota' },
      { value: 'Corolla', displayName: 'Corolla', count: 1200, make: 'Toyota' },
      { value: 'RAV4', displayName: 'RAV4', count: 950, make: 'Toyota' },
      { value: 'Prius', displayName: 'Prius', count: 680, make: 'Toyota' },
      { value: 'Highlander', displayName: 'Highlander', count: 580, make: 'Toyota' },
      { value: 'Tacoma', displayName: 'Tacoma', count: 520, make: 'Toyota' },
      { value: 'Sienna', displayName: 'Sienna', count: 380, make: 'Toyota' },
      { value: 'Tundra', displayName: 'Tundra', count: 350, make: 'Toyota' },
      { value: '4Runner', displayName: '4Runner', count: 320, make: 'Toyota' },
      { value: 'Avalon', displayName: 'Avalon', count: 280, make: 'Toyota' },
      { value: 'C-HR', displayName: 'C-HR', count: 220, make: 'Toyota' },
      { value: 'Yaris', displayName: 'Yaris', count: 180, make: 'Toyota' },
      { value: 'Sequoia', displayName: 'Sequoia', count: 150, make: 'Toyota' },
      { value: 'Land Cruiser', displayName: 'Land Cruiser', count: 120, make: 'Toyota' },
      { value: 'Venza', displayName: 'Venza', count: 100, make: 'Toyota' },
      { value: 'Matrix', displayName: 'Matrix', count: 90, make: 'Toyota' },
      { value: 'FJ Cruiser', displayName: 'FJ Cruiser', count: 80, make: 'Toyota' },
      
      // Honda models - comprehensive list
      { value: 'Accord', displayName: 'Accord', count: 1600, make: 'Honda' },
      { value: 'Civic', displayName: 'Civic', count: 1400, make: 'Honda' },
      { value: 'CR-V', displayName: 'CR-V', count: 980, make: 'Honda' },
      { value: 'Pilot', displayName: 'Pilot', count: 520, make: 'Honda' },
      { value: 'Odyssey', displayName: 'Odyssey', count: 420, make: 'Honda' },
      { value: 'Fit', displayName: 'Fit', count: 380, make: 'Honda' },
      { value: 'HR-V', displayName: 'HR-V', count: 320, make: 'Honda' },
      { value: 'Ridgeline', displayName: 'Ridgeline', count: 280, make: 'Honda' },
      { value: 'Passport', displayName: 'Passport', count: 220, make: 'Honda' },
      { value: 'Insight', displayName: 'Insight', count: 180, make: 'Honda' },
      { value: 'Element', displayName: 'Element', count: 150, make: 'Honda' },
      { value: 'S2000', displayName: 'S2000', count: 120, make: 'Honda' },
      { value: 'Crosstour', displayName: 'Crosstour', count: 100, make: 'Honda' },
      { value: 'Prelude', displayName: 'Prelude', count: 80, make: 'Honda' },
      { value: 'Del Sol', displayName: 'Del Sol', count: 60, make: 'Honda' },
      
      // Nissan models - comprehensive list
      { value: 'Altima', displayName: 'Altima', count: 650, make: 'Nissan' },
      { value: 'Sentra', displayName: 'Sentra', count: 420, make: 'Nissan' },
      { value: 'Rogue', displayName: 'Rogue', count: 580, make: 'Nissan' },
      { value: 'Pathfinder', displayName: 'Pathfinder', count: 380, make: 'Nissan' },
      { value: 'Maxima', displayName: 'Maxima', count: 320, make: 'Nissan' },
      { value: 'Murano', displayName: 'Murano', count: 280, make: 'Nissan' },
      { value: 'Frontier', displayName: 'Frontier', count: 250, make: 'Nissan' },
      { value: 'Titan', displayName: 'Titan', count: 220, make: 'Nissan' },
      { value: 'Armada', displayName: 'Armada', count: 180, make: 'Nissan' },
      { value: 'Versa', displayName: 'Versa', count: 150, make: 'Nissan' },
      { value: '370Z', displayName: '370Z', count: 120, make: 'Nissan' },
      { value: 'Kicks', displayName: 'Kicks', count: 100, make: 'Nissan' },
      { value: 'Juke', displayName: 'Juke', count: 90, make: 'Nissan' },
      { value: 'Quest', displayName: 'Quest', count: 80, make: 'Nissan' },
      { value: 'Xterra', displayName: 'Xterra', count: 70, make: 'Nissan' },
      { value: '350Z', displayName: '350Z', count: 60, make: 'Nissan' }
    ],
    years
  };
}

// Clear the cache (useful for testing or manual refresh)
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