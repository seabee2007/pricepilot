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

    // Use multiple targeted searches to get better vehicle data coverage
    const searchQueries = [
      'Ford F-150', // Popular truck
      'Toyota Camry', // Popular sedan  
      'Honda Civic', // Popular compact
      'Chevrolet Silverado', // Popular truck
      'BMW 3 Series', // Luxury
      'Dodge Charger' // Muscle car
    ];

    const allItems: any[] = [];
    
    // Search with multiple popular vehicle queries to get diverse data
    for (const query of searchQueries) {
      try {
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
            pageSize: 100, // Get more results per query
            mode: 'live'
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`Browse API response for "${query}":`, data.items?.length || 0, 'vehicles');
          if (data.items?.length > 0) {
            allItems.push(...data.items);
          }
        }
      } catch (error) {
        console.warn(`Search failed for "${query}":`, error);
      }
    }

    console.log('Total vehicles from all searches:', allItems.length);
    
    // Extract vehicle data from actual eBay listings
    const makes = new Set<string>();
    const models = new Set<string>();
    const years = new Set<string>();
    
    // Parse vehicle data from listing titles and item specifics
    allItems.forEach((item: any) => {
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
      
      // Try to extract make/model from title using common patterns
      const titleUpper = title.toUpperCase();
      
      // Common makes to look for in titles
      const commonMakes = ['FORD', 'TOYOTA', 'HONDA', 'CHEVROLET', 'CHEVY', 'BMW', 'MERCEDES', 'AUDI', 'NISSAN', 'DODGE', 'JEEP', 'CADILLAC', 'LEXUS', 'MAZDA', 'SUBARU', 'VOLKSWAGEN', 'VW', 'HYUNDAI', 'KIA', 'BUICK', 'GMC', 'LINCOLN', 'ACURA', 'INFINITI'];
      
      commonMakes.forEach(make => {
        if (titleUpper.includes(make)) {
          // Normalize make names
          const normalizedMake = make === 'CHEVY' ? 'Chevrolet' : 
                                  make === 'VW' ? 'Volkswagen' :
                                  make.charAt(0) + make.slice(1).toLowerCase();
          makes.add(normalizedMake);
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

    // Use multiple search approaches for better model coverage
    const searchQueries = [
      make, // Just the make name
      `${make} ${year || ''}`.trim(), // Make with year if provided
    ];
    
    // Add common models for popular makes to search queries
    const popularModels = getCommonModelsForMake(make);
    if (popularModels.length > 0) {
      // Add searches for the most popular models
      const topModels = popularModels.slice(0, 3);
      topModels.forEach(model => {
        searchQueries.push(`${make} ${model.value}`);
      });
    }

    const allItems: any[] = [];
    const foundModels = new Set<string>();
    
    // Search with multiple queries to get diverse model data
    for (const query of searchQueries) {
      try {
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
            pageSize: 50, // Reasonable number per query
            mode: 'live'
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`Browse API response for "${query}":`, data.items?.length || 0, 'vehicles');
          if (data.items?.length > 0) {
            allItems.push(...data.items);
          }
        }
      } catch (error) {
        console.warn(`Search failed for "${query}":`, error);
      }
    }

    console.log(`Total vehicles found for ${make}:`, allItems.length);
    
    // Extract models from actual eBay listings
    allItems.forEach((item: any) => {
      const title = item.title || '';
      const itemSpecifics = item.localizedAspects || [];
      
      // Extract from item specifics if available
      itemSpecifics.forEach((aspect: any) => {
        if (aspect.name === 'Model' && aspect.value) {
          foundModels.add(aspect.value);
        }
        if (aspect.name === 'Make' && aspect.value?.toLowerCase() === make.toLowerCase()) {
          // This confirms it's the right make
        }
      });
      
      // Extract model from title using pattern matching
      const titleUpper = title.toUpperCase();
      const makeUpper = make.toUpperCase();
      
      // Find the make in the title and try to extract the model that follows
      const makeIndex = titleUpper.indexOf(makeUpper);
      if (makeIndex >= 0) {
        // Look for model patterns after the make
        const afterMake = title.substring(makeIndex + make.length).trim();
        const words = afterMake.split(/\s+/);
        
        // Common model patterns to extract
        if (words.length > 0) {
          let potentialModel = words[0];
          
          // Handle multi-word models (e.g., "F-150", "3 Series")
          if (words.length > 1) {
            const secondWord = words[1];
            // Combine if it looks like a multi-part model name
            if (secondWord.match(/^(Series|Class|\d+|[A-Z]+)$/i)) {
              potentialModel = `${potentialModel} ${secondWord}`;
            }
          }
          
          // Clean up the model name
          potentialModel = potentialModel
            .replace(/[^\w\s-]/g, '') // Remove special chars except hyphens
            .trim();
          
          if (potentialModel && potentialModel.length > 1) {
            foundModels.add(potentialModel);
          }
        }
      }
    });
    
    // Convert to VehicleAspect format
    const modelsList = Array.from(foundModels)
      .filter(model => model.length > 1) // Filter out single characters
      .sort()
      .map(model => ({
        value: model,
        displayName: model,
        count: 100,
        make
      }));
    
    console.log(`Found ${modelsList.length} models for ${make} from Browse API`);
    
    // If we found models from API, return them combined with common models
    if (modelsList.length > 0) {
      const commonModels = getCommonModelsForMake(make);
      const combinedModels = [...modelsList, ...commonModels]
        .filter((model, index, self) => 
          index === self.findIndex(m => m.value === model.value)
        )
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
      
      console.log(`Combined total: ${combinedModels.length} models for ${make}`);
      return combinedModels;
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