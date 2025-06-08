import React from 'react';
import { formatCurrency } from '../../lib/utils';

interface PriceBarChartProps {
  low: number;
  avg: number;
  high: number;
  currentPrice?: number;
  currency?: string;
  className?: string;
}

/**
 * Visual price indicator component that shows market pricing as a color-coded bar chart
 * Red (low) → Yellow (avg) → Green (high) with current price indicator
 */
export const PriceBarChart: React.FC<PriceBarChartProps> = ({ 
  low, 
  avg, 
  high, 
  currentPrice,
  currency = 'USD',
  className = '' 
}) => {
  // Calculate percentages for positioning
  const range = high - low;
  const avgPosition = range > 0 ? ((avg - low) / range) * 100 : 50;
  
  // Determine current price status
  const getCurrentPriceStatus = (price: number) => {
    if (price <= avg * 0.85) return { color: 'text-green-600 dark:text-green-400', label: 'Great Deal', bgColor: 'bg-green-100 dark:bg-green-900/30' };
    if (price <= avg * 1.1) return { color: 'text-yellow-600 dark:text-yellow-400', label: 'Fair Price', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' };
    return { color: 'text-red-600 dark:text-red-400', label: 'Above Market', bgColor: 'bg-red-100 dark:bg-red-900/30' };
  };

  const currentStatus = currentPrice ? getCurrentPriceStatus(currentPrice) : null;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Market Value Range</h4>
        {currentPrice && currentStatus && (
          <div className={`px-3 py-1 rounded-full text-sm font-semibold ${currentStatus.bgColor} ${currentStatus.color}`}>
            {currentStatus.label}
          </div>
        )}
      </div>

      {/* Improved Visual Bar Chart */}
      <div className="space-y-4">
        {/* Price Range Bar - Simplified without confusing lines */}
        <div className="relative">
          {/* Main gradient bar */}
          <div className="h-6 rounded-lg overflow-hidden bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 relative">
            {/* Average price indicator - small triangle below bar instead of confusing line */}
            <div 
              className="absolute -bottom-3 transform -translate-x-1/2"
              style={{ left: `${avgPosition}%` }}
            >
              <div className="w-0 h-0 border-l-2 border-r-2 border-b-3 border-l-transparent border-r-transparent border-b-gray-600 dark:border-b-gray-300"></div>
            </div>
          </div>
          
          {/* Average label */}
          <div 
            className="absolute -bottom-8 transform -translate-x-1/2 text-xs text-gray-600 dark:text-gray-400"
            style={{ left: `${avgPosition}%` }}
          >
            Avg
          </div>
        </div>

        {/* Price Labels - Cleaner layout */}
        <div className="flex justify-between items-center text-sm pt-4">
          <div className="flex flex-col items-start">
            <span className="text-red-600 dark:text-red-400 font-semibold">
              {formatCurrency(low, currency)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Low Market</span>
          </div>
          
          <div className="flex flex-col items-center">
            <span className="text-gray-800 dark:text-gray-200 font-bold">
              {formatCurrency(avg, currency)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Average</span>
          </div>
          
          <div className="flex flex-col items-end">
            <span className="text-green-600 dark:text-green-400 font-semibold">
              {formatCurrency(high, currency)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">High Market</span>
          </div>
        </div>

        {/* Current Price Analysis - Much clearer section */}
        {currentPrice && currentStatus && (
          <div className={`mt-4 p-3 rounded-lg border-l-4 ${currentStatus.bgColor} ${currentStatus.color.includes('green') ? 'border-green-500' : currentStatus.color.includes('yellow') ? 'border-yellow-500' : 'border-red-500'}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Listed at {formatCurrency(currentPrice, currency)}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {currentPrice > avg ? 
                    `${formatCurrency(currentPrice - avg, currency)} above average` : 
                    `${formatCurrency(avg - currentPrice, currency)} below average`
                  } ({((currentPrice - avg) / avg * 100).toFixed(1)}%)
                </div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold ${currentStatus.color}`}>
                  {currentStatus.label}
                </div>
                {currentPrice <= avg * 0.85 && (
                  <div className="text-xs text-green-600 dark:text-green-400">
                    💰 Excellent value!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Explanation text */}
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Price range from recent market data • Average marked with ▼
        </div>
      </div>
    </div>
  );
};

export default PriceBarChart; 