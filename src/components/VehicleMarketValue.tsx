import React, { useState, useEffect } from 'react';
import { getVehicleValue, VehicleValueResponse } from '../lib/supabase';
import { Loader2, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import PriceBarChart from './ui/PriceBarChart';

interface VehicleMarketValueProps {
  make: string;
  model: string;
  year: number;
  mileage?: number;
  trim?: string;
  zipCode?: string;
  className?: string;
}

export function VehicleMarketValue({ 
  make, 
  model, 
  year, 
  mileage, 
  trim, 
  zipCode,
  className = ""
}: VehicleMarketValueProps) {
  const [market, setMarket] = useState<{ low: number; avg: number; high: number }>({ 
    low: 0, 
    avg: 0, 
    high: 0 
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    
    getVehicleValue({ make, model, year, mileage, trim, zipCode })
      .then((data: VehicleValueResponse) => {
        setMarket({
          low: data.low || 0,
          avg: data.avg || data.value || 0, // Fallback to legacy value field
          high: data.high || 0
        });
      })
      .catch((err) => {
        console.error('Error fetching vehicle market value:', err);
        setError(err.message || 'Failed to load market data');
      })
      .finally(() => setLoading(false));
  }, [make, model, year, mileage, trim, zipCode]);

  if (loading) {
    return (
      <div className={`p-4 bg-white dark:bg-gray-800 rounded-lg border ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
          <p className="text-gray-600 dark:text-gray-400">Loading market data…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-white dark:bg-gray-800 rounded-lg border border-red-200 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <TrendingDown className="h-6 w-6 text-red-500 mr-2" />
          <p className="text-red-600 dark:text-red-400">Unable to load market data</p>
        </div>
      </div>
    );
  }

  const hasValidData = market.low > 0 || market.avg > 0 || market.high > 0;

  if (!hasValidData) {
    return (
      <div className={`p-4 bg-white dark:bg-gray-800 rounded-lg border ${className}`}>
        <div className="flex items-center justify-center py-8">
          <DollarSign className="h-6 w-6 text-gray-400 mr-2" />
          <p className="text-gray-600 dark:text-gray-400">No market data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-white dark:bg-gray-800 rounded-lg border ${className}`}>
      <div className="flex items-center mb-4">
        <TrendingUp className="h-5 w-5 text-green-500 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Market Value: {year} {make} {model}
        </h3>
      </div>
      
      <PriceBarChart
        low={market.low}
        avg={market.avg}
        high={market.high}
        currency="USD"
        className="bg-transparent dark:bg-transparent p-0"
      />
      
      {trim && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
          Trim: {trim} {mileage && `• ${mileage.toLocaleString()} miles`} {zipCode && `• ${zipCode}`}
        </p>
      )}
    </div>
  );
} 