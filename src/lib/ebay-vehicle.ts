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
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export async function getVehicleAspects(): Promise<VehicleAspects> {
  // Return cached data if still valid
  if (aspectsCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return aspectsCache;
  }

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
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch vehicle aspects: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Cache the results
    aspectsCache = data;
    cacheTimestamp = Date.now();
    
    return data;
  } catch (error) {
    console.error('Error fetching vehicle aspects:', error);
    
    // Return fallback data if API fails
    return getFallbackVehicleAspects();
  }
}

// Fallback vehicle data for when API is unavailable
function getFallbackVehicleAspects(): VehicleAspects {
  const currentYear = new Date().getFullYear();
  const years: VehicleAspect[] = [];
  
  // Generate years from current year back to 1990
  for (let year = currentYear; year >= 1990; year--) {
    years.push({
      value: year.toString(),
      displayName: year.toString(),
      count: 0
    });
  }

  return {
    makes: [
      { value: 'Acura', displayName: 'Acura', count: 0 },
      { value: 'Audi', displayName: 'Audi', count: 0 },
      { value: 'BMW', displayName: 'BMW', count: 0 },
      { value: 'Buick', displayName: 'Buick', count: 0 },
      { value: 'Cadillac', displayName: 'Cadillac', count: 0 },
      { value: 'Chevrolet', displayName: 'Chevrolet', count: 0 },
      { value: 'Chrysler', displayName: 'Chrysler', count: 0 },
      { value: 'Dodge', displayName: 'Dodge', count: 0 },
      { value: 'Ford', displayName: 'Ford', count: 0 },
      { value: 'GMC', displayName: 'GMC', count: 0 },
      { value: 'Honda', displayName: 'Honda', count: 0 },
      { value: 'Hyundai', displayName: 'Hyundai', count: 0 },
      { value: 'Infiniti', displayName: 'Infiniti', count: 0 },
      { value: 'Jeep', displayName: 'Jeep', count: 0 },
      { value: 'Kia', displayName: 'Kia', count: 0 },
      { value: 'Lexus', displayName: 'Lexus', count: 0 },
      { value: 'Lincoln', displayName: 'Lincoln', count: 0 },
      { value: 'Mazda', displayName: 'Mazda', count: 0 },
      { value: 'Mercedes-Benz', displayName: 'Mercedes-Benz', count: 0 },
      { value: 'Mitsubishi', displayName: 'Mitsubishi', count: 0 },
      { value: 'Nissan', displayName: 'Nissan', count: 0 },
      { value: 'Pontiac', displayName: 'Pontiac', count: 0 },
      { value: 'Porsche', displayName: 'Porsche', count: 0 },
      { value: 'Ram', displayName: 'Ram', count: 0 },
      { value: 'Subaru', displayName: 'Subaru', count: 0 },
      { value: 'Tesla', displayName: 'Tesla', count: 0 },
      { value: 'Toyota', displayName: 'Toyota', count: 0 },
      { value: 'Volkswagen', displayName: 'Volkswagen', count: 0 },
      { value: 'Volvo', displayName: 'Volvo', count: 0 }
    ],
    models: [
      // Popular models - these would normally be filtered by make
      { value: 'Accord', displayName: 'Accord', count: 0, make: 'Honda' },
      { value: 'Camry', displayName: 'Camry', count: 0, make: 'Toyota' },
      { value: 'Civic', displayName: 'Civic', count: 0, make: 'Honda' },
      { value: 'Corolla', displayName: 'Corolla', count: 0, make: 'Toyota' },
      { value: 'F-150', displayName: 'F-150', count: 0, make: 'Ford' },
      { value: 'Silverado', displayName: 'Silverado', count: 0, make: 'Chevrolet' },
      { value: 'Ram 1500', displayName: 'Ram 1500', count: 0, make: 'Ram' },
      { value: 'Mustang', displayName: 'Mustang', count: 0, make: 'Ford' },
      { value: 'Camaro', displayName: 'Camaro', count: 0, make: 'Chevrolet' },
      { value: 'Challenger', displayName: 'Challenger', count: 0, make: 'Dodge' },
      { value: 'Viper', displayName: 'Viper', count: 0, make: 'Dodge' },
      { value: 'Corvette', displayName: 'Corvette', count: 0, make: 'Chevrolet' }
    ],
    years
  };
}

// Clear the cache (useful for testing or manual refresh)
export function clearVehicleAspectsCache(): void {
  aspectsCache = null;
  cacheTimestamp = 0;
}