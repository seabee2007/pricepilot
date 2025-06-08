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
 * Red (low) → Yellow (avg) → Green (high) with current price marker
 */
export const PriceBarChart: React.FC<PriceBarChartProps> = ({ 
  low, 
  avg, 
  high, 
  currentPrice,
  currency = 'USD',
  className = '' 
}) => {
  // Calculate percentages for the gradient bar
  const range = high - low;
  const avgPosition = range > 0 ? ((avg - low) / range) * 100 : 50;
  const currentPosition = currentPrice && range > 0 ? ((currentPrice - low) / range) * 100 : null;
  
  // Determine current price color based on position
  const getCurrentPriceColor = (price: number) => {
    if (price <= avg * 0.85) return 'text-green-600 dark:text-green-400'; // Great deal
    if (price <= avg * 1.1) return 'text-yellow-600 dark:text-yellow-400'; // Fair price
    return 'text-red-600 dark:text-red-400'; // Above market
  };

  const getCurrentPriceLabel = (price: number) => {
    if (price <= avg * 0.85) return 'Great Deal';
    if (price <= avg * 1.1) return 'Fair Price';
    return 'Above Market';
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Market Value Range</h4>
        {currentPrice && (
          <div className="text-right">
            <div className={`text-sm font-semibold ${getCurrentPriceColor(currentPrice)}`}>
              {getCurrentPriceLabel(currentPrice)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              vs {formatCurrency(avg, currency)} avg
            </div>
          </div>
        )}
      </div>

      {/* Visual Bar Chart */}
      <div className="space-y-3">
        {/* Price Bar with Gradient */}
        <div className="relative h-8 rounded-lg overflow-hidden bg-gradient-to-r from-red-400 via-yellow-400 to-green-400">
          {/* Average marker */}
          <div 
            className="absolute top-0 w-1 h-full bg-gray-800 dark:bg-white shadow-lg"
            style={{ left: `${avgPosition}%` }}
          >
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
              <div className="bg-gray-800 dark:bg-white text-white dark:text-gray-800 text-xs px-2 py-1 rounded whitespace-nowrap">
                Avg
              </div>
            </div>
          </div>
          
          {/* Current price marker */}
          {currentPrice && currentPosition !== null && (
            <div 
              className="absolute top-0 w-1 h-full bg-blue-600 shadow-lg z-10"
              style={{ left: `${Math.max(0, Math.min(100, currentPosition))}%` }}
            >
              <div className="absolute -top-10 left-1/2 transform -translate-x-1/2">
                <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  Listed
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Price Labels */}
        <div className="flex justify-between items-center text-sm">
          <div className="flex flex-col items-start">
            <span className="text-red-600 dark:text-red-400 font-semibold">
              {formatCurrency(low, currency)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Low</span>
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
            <span className="text-xs text-gray-500 dark:text-gray-400">High</span>
          </div>
        </div>

        {/* Current Price Analysis */}
        {currentPrice && (
          <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Listed Price:</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(currentPrice, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-gray-500 dark:text-gray-400">vs Average:</span>
              <span className={getCurrentPriceColor(currentPrice)}>
                {currentPrice > avg ? '+' : ''}{formatCurrency(currentPrice - avg, currency)} 
                ({((currentPrice - avg) / avg * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PriceBarChart; 