import React, { useState, useEffect } from 'react';
import { getVehicleValue, VehicleValueResponse } from '../lib/supabase';
import { Loader2, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

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
      
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-1">Low</p>
          <p className="text-xl font-bold text-red-700 dark:text-red-300">
            ${market.low.toLocaleString()}
          </p>
        </div>
        
        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">Average</p>
          <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
            ${market.avg.toLocaleString()}
          </p>
        </div>
        
        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">High</p>
          <p className="text-xl font-bold text-green-700 dark:text-green-300">
            ${market.high.toLocaleString()}
          </p>
        </div>
      </div>
      
      {trim && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
          Trim: {trim} {mileage && `• ${mileage.toLocaleString()} miles`} {zipCode && `• ${zipCode}`}
        </p>
      )}
    </div>
  );
} 