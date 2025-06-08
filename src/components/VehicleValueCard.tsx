import React, { useState, useEffect } from 'react';
import { VehicleValueRequest, VehicleValueResponse, VehicleHistoryPoint, getVehicleMarketValue, getVehicleHistory } from '../lib/supabase';
import { TrendingUp, TrendingDown, DollarSign, Calendar, Loader2, AlertCircle } from 'lucide-react';
import Button from './ui/Button';

interface VehicleValueCardProps {
  initialRequest?: Partial<VehicleValueRequest>;
  onValueUpdate?: (value: VehicleValueResponse) => void;
}

const VehicleValueCard = ({ initialRequest, onValueUpdate }: VehicleValueCardProps) => {
  const [request, setRequest] = useState<VehicleValueRequest>({
    make: initialRequest?.make || '',
    model: initialRequest?.model || '',
    year: initialRequest?.year || new Date().getFullYear(),
    mileage: initialRequest?.mileage,
    trim: initialRequest?.trim,
    zipCode: initialRequest?.zipCode
  });
  
  const [vehicleValue, setVehicleValue] = useState<VehicleValueResponse | null>(null);
  const [history, setHistory] = useState<VehicleHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookupValue = async () => {
    if (!request.make || !request.model || !request.year) {
      setError('Make, model, and year are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get current vehicle value using new scraping approach
      const valueResponse = await getVehicleMarketValue(request);
      setVehicleValue(valueResponse);
      
      if (onValueUpdate) {
        onValueUpdate(valueResponse);
      }

      // Get historical data
      try {
        const historyData = await getVehicleHistory(request.make, request.model, request.year);
        setHistory(historyData);
      } catch (historyError) {
        console.warn('Could not fetch history data:', historyError);
        // Continue without history data
      }

    } catch (err) {
      console.error('Vehicle lookup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get vehicle market value');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const calculateTrend = () => {
    if (history.length < 2) return null;
    
    const recent = history[history.length - 1];
    const older = history[0];
    
    if (!recent || !older) return null;
    
    const change = recent.avg_value - older.avg_value;
    const percentChange = (change / older.avg_value) * 100;
    
    return {
      change,
      percentChange,
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
    };
  };

  const trend = calculateTrend();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Vehicle Market Value</h3>
        
        {/* Input Form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Make</label>
            <input
              type="text"
              value={request.make}
              onChange={(e) => setRequest(prev => ({ ...prev, make: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="e.g., Audi"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model</label>
            <input
              type="text"
              value={request.model}
              onChange={(e) => setRequest(prev => ({ ...prev, model: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="e.g., A3"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year</label>
            <input
              type="number"
              value={request.year}
              onChange={(e) => setRequest(prev => ({ ...prev, year: parseInt(e.target.value) || new Date().getFullYear() }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              min="1900"
              max={new Date().getFullYear() + 1}
            />
          </div>
        </div>

        {/* Optional Fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mileage (optional)</label>
            <input
              type="number"
              value={request.mileage || ''}
              onChange={(e) => setRequest(prev => ({ ...prev, mileage: e.target.value ? parseInt(e.target.value) : undefined }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="e.g., 50000"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trim (optional)</label>
            <input
              type="text"
              value={request.trim || ''}
              onChange={(e) => setRequest(prev => ({ ...prev, trim: e.target.value || undefined }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="e.g., Premium"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ZIP Code (optional)</label>
            <input
              type="text"
              value={request.zipCode || ''}
              onChange={(e) => setRequest(prev => ({ ...prev, zipCode: e.target.value || undefined }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="e.g., 90210"
            />
          </div>
        </div>

        <Button
          onClick={handleLookupValue}
          disabled={loading || !request.make || !request.model || !request.year}
          className="w-full md:w-auto"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Getting Market Value...
            </>
          ) : (
            <>
              <DollarSign className="w-4 h-4 mr-2" />
              Get Market Value
            </>
          )}
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 flex items-center">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Value Display */}
      {vehicleValue && (
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {vehicleValue.year} {vehicleValue.make} {vehicleValue.model}
                </h4>
                
                {/* Display Low/Avg/High values if available from scraping */}
                {vehicleValue.low !== undefined && vehicleValue.avg !== undefined && vehicleValue.high !== undefined ? (
                  <div className="mt-2 space-y-2">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(vehicleValue.avg, vehicleValue.currency)}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Average Market Value</p>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                          {formatCurrency(vehicleValue.low, vehicleValue.currency)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Low</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(vehicleValue.avg, vehicleValue.currency)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Avg</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency(vehicleValue.high, vehicleValue.currency)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">High</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Fallback for single value (legacy API) */
                  <div className="mt-2">
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(vehicleValue.value || 0, vehicleValue.currency)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Market Value</p>
                  </div>
                )}
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {vehicleValue.cached ? 'Cached' : 'Live'} Data • Source: {vehicleValue.source === 'web_scraping' ? 'Web Scraping' : 'API'}
                </p>
              </div>
              
              {trend && (
                <div className="text-right">
                  <div className={`flex items-center ${trend.direction === 'up' ? 'text-green-600 dark:text-green-400' : trend.direction === 'down' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                    {trend.direction === 'up' ? (
                      <TrendingUp className="w-5 h-5 mr-1" />
                    ) : trend.direction === 'down' ? (
                      <TrendingDown className="w-5 h-5 mr-1" />
                    ) : (
                      <Calendar className="w-5 h-5 mr-1" />
                    )}
                    <span className="font-medium">
                      {trend.percentChange > 0 ? '+' : ''}{trend.percentChange.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">vs. 30 days ago</p>
                </div>
              )}
            </div>
          </div>

          {/* Historical Data Summary */}
          {history.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">30-Day History</h5>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Data Points</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {history.reduce((sum, point) => sum + point.data_points, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Avg Value</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency(history.reduce((sum, point) => sum + point.avg_value, 0) / history.length)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Days Tracked</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{history.length}</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p>Data from {vehicleValue.source === 'web_scraping' ? 'AutoTrader, Cars.com, eBay Motors, CarGurus via Web Scraping' : 'RapidAPI Vehicle Pricing'} • Last updated: {new Date(vehicleValue.timestamp).toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleValueCard; 