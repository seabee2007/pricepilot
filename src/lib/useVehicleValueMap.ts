import { useState, useEffect } from 'react';
import { getVehicleValue, VehicleValueResponse, parseVehicleFromQuery } from './supabase';
import { ItemSummary } from '../types';

export interface VehicleValue {
  low?: number;
  avg?: number;
  high?: number;
  cached?: boolean;
  timestamp?: string;
  source?: string;
  currency?: string;
}

export type VehicleValueMap = Record<string, VehicleValue>;

/**
 * Extract unique vehicle keys from search results
 * Returns an array of unique "make|model|year" keys
 */
export function extractUniqueVehicleKeys(items: ItemSummary[]): string[] {
  const vehicleKeysSet = new Set<string>();
  
  items.forEach(item => {
    const vehicleInfo = parseVehicleFromQuery(item.title);
    if (vehicleInfo?.make && vehicleInfo?.model && vehicleInfo?.year) {
      const key = `${vehicleInfo.make}|${vehicleInfo.model}|${vehicleInfo.year}`;
      vehicleKeysSet.add(key);
    }
  });
  
  return Array.from(vehicleKeysSet);
}

/**
 * Custom hook that fetches vehicle market values for multiple unique vehicles
 * Returns a map of vehicle keys to their market value data
 * Eliminates duplicate requests by fetching each unique vehicle only once
 */
export function useVehicleValueMap(uniqueKeys: string[]): {
  valueMap: VehicleValueMap;
  loading: boolean;
  error: string | null;
} {
  const [valueMap, setValueMap] = useState<VehicleValueMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (uniqueKeys.length === 0) {
      setValueMap({});
      setLoading(false);
      return;
    }

    const fetchAllVehicleValues = async () => {
      setLoading(true);
      setError(null);
      
      const newValueMap: VehicleValueMap = {};
      
      try {
        // Fetch values for all unique keys in parallel
        const promises = uniqueKeys.map(async (key) => {
          try {
            const [make, model, year] = key.split('|');
            if (!make || !model || !year) {
              console.warn(`Invalid vehicle key format: ${key}`);
              return;
            }

            const result: VehicleValueResponse = await getVehicleValue({
              make,
              model,
              year: parseInt(year),
              mileage: undefined, // We don't have mileage from search results
              trim: undefined,   // We don't have trim from search results
              zipCode: undefined // We don't have zipCode from search results
            });
            
            if (result) {
              newValueMap[key] = {
                low: result.low,
                avg: result.avg,
                high: result.high,
                cached: result.cached,
                timestamp: result.timestamp,
                source: result.source,
                currency: result.currency || 'USD'
              };
            }
          } catch (err) {
            console.error(`Error fetching vehicle value for ${key}:`, err);
            // Don't fail the entire operation for one vehicle
          }
        });

        await Promise.all(promises);
        setValueMap(newValueMap);
        
      } catch (err) {
        console.error('Error fetching vehicle values:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch vehicle values');
      } finally {
        setLoading(false);
      }
    };

    fetchAllVehicleValues();
  }, [uniqueKeys.join(',')]); // Re-run when the keys change

  return { valueMap, loading, error };
} 