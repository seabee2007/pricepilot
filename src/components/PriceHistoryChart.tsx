import { useState, useEffect } from 'react';
import { PriceHistory } from '../types';
import { formatCurrency } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { TrendingUp, TrendingDown, Minus, BarChart3, Activity } from 'lucide-react';

interface PriceHistoryChartProps {
  data?: PriceHistory[];
  query: string;
  searchId?: string;
  showSparkline?: boolean;
  className?: string;
}

interface DayPoint {
  day: string;
  low_price: number;
  high_price: number;
  avg_price: number;
  data_points: number;
  formatted_day: string;
}

const PriceHistoryChart = ({ 
  data = [], 
  query, 
  searchId, 
  showSparkline = false,
  className = ""
}: PriceHistoryChartProps) => {
  const [chartData, setChartData] = useState<DayPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priceStats, setPriceStats] = useState<{
    trend: 'up' | 'down' | 'stable';
    change: number;
    changePercent: number;
    currentPrice: number;
    highPrice: number;
    lowPrice: number;
  } | null>(null);

  useEffect(() => {
    const fetch30DayHistory = async () => {
      setLoading(true);
      setError(null);
      
      try {
        let result;
        
        // Try to fetch by search_id first, then fall back to query
        if (searchId) {
          result = await supabase.rpc('get_30d_price_history', { 
            p_search_id: searchId 
          });
        } else {
          result = await supabase.rpc('get_30d_price_history_by_query', { 
            p_query: query 
          });
        }

        if (result.error) {
          console.error('Error fetching price history:', result.error);
          // Fallback to legacy data if RPC fails
          if (data && data.length > 0) {
            const legacyData = data.map(item => ({
              day: format(new Date(item.timestamp), 'yyyy-MM-dd'),
              low_price: item.avg_price,
              high_price: item.avg_price,
              avg_price: item.avg_price,
              data_points: 1,
              formatted_day: format(new Date(item.timestamp), 'MMM dd')
            }));
            setChartData(legacyData);
            calculatePriceStats(legacyData);
          } else {
            setError('No price history data available');
          }
          return;
        }

        const historyData = (result.data || []).map((item: any) => ({
          day: item.day,
          low_price: parseFloat(item.low_price) || 0,
          high_price: parseFloat(item.high_price) || 0,
          avg_price: parseFloat(item.avg_price) || 0,
          data_points: parseInt(item.data_points) || 0,
          formatted_day: format(parseISO(item.day), 'MMM dd')
        }));

        setChartData(historyData);
        calculatePriceStats(historyData);
      } catch (err) {
        console.error('Error fetching price history:', err);
        setError('Failed to load price history');
      } finally {
        setLoading(false);
      }
    };

    fetch30DayHistory();
  }, [query, searchId, data]);

  const calculatePriceStats = (data: DayPoint[]) => {
    if (data.length < 2) {
      setPriceStats(null);
      return;
    }

    const sortedData = [...data].sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime());
    const firstPrice = sortedData[0].avg_price;
    const lastPrice = sortedData[sortedData.length - 1].avg_price;
    const change = lastPrice - firstPrice;
    const changePercent = firstPrice > 0 ? (change / firstPrice) * 100 : 0;
    
    const allPrices = data.flatMap(d => [d.low_price, d.high_price, d.avg_price]);
    const highPrice = Math.max(...allPrices);
    const lowPrice = Math.min(...allPrices);

    setPriceStats({
      trend: Math.abs(changePercent) < 1 ? 'stable' : changePercent > 0 ? 'up' : 'down',
      change,
      changePercent,
      currentPrice: lastPrice,
      highPrice,
      lowPrice
    });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 shadow-lg rounded-lg">
          <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">
            {format(parseISO(label), 'MMMM dd, yyyy')}
          </p>
          <div className="space-y-1">
            <p className="text-green-600 dark:text-green-400 text-sm">
              <span className="font-medium">Low:</span> {formatCurrency(data.low_price)}
            </p>
            <p className="text-blue-600 dark:text-blue-400 text-sm font-bold">
              <span className="font-medium">Average:</span> {formatCurrency(data.avg_price)}
            </p>
            <p className="text-orange-600 dark:text-orange-400 text-sm">
              <span className="font-medium">High:</span> {formatCurrency(data.high_price)}
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-xs">
              {data.data_points} data point{data.data_points !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            30-Day Price History
          </h2>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
          </div>
        </div>
        <div className="h-64 md:h-80 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error || chartData.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          30-Day Price History
        </h2>
        <div className="text-center py-8">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            {error || 'No price history data available yet. Check back after some searches have been saved.'}
          </p>
        </div>
      </div>
    );
  }

  // Sparkline version (compact)
  if (showSparkline) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${className}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Price Trend</h3>
          {priceStats && (
            <div className="flex items-center space-x-1">
              {priceStats.trend === 'up' && <TrendingUp className="h-4 w-4 text-red-500" />}
              {priceStats.trend === 'down' && <TrendingDown className="h-4 w-4 text-green-500" />}
              {priceStats.trend === 'stable' && <Minus className="h-4 w-4 text-gray-500" />}
              <span className={`text-sm font-medium ${
                priceStats.trend === 'up' ? 'text-red-600' : 
                priceStats.trend === 'down' ? 'text-green-600' : 'text-gray-600'
              }`}>
                {priceStats.changePercent > 0 ? '+' : ''}{priceStats.changePercent.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line 
                type="monotone" 
                dataKey="avg_price" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, fill: '#1e40af' }}
              />
              <Tooltip content={<CustomTooltip />} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // Full chart version
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          30-Day Price History for "{query}"
        </h2>
        {priceStats && (
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-1">
              {priceStats.trend === 'up' && <TrendingUp className="h-4 w-4 text-red-500" />}
              {priceStats.trend === 'down' && <TrendingDown className="h-4 w-4 text-green-500" />}
              {priceStats.trend === 'stable' && <Minus className="h-4 w-4 text-gray-500" />}
              <span className={`font-medium ${
                priceStats.trend === 'up' ? 'text-red-600 dark:text-red-400' : 
                priceStats.trend === 'down' ? 'text-green-600 dark:text-green-400' : 
                'text-gray-600 dark:text-gray-400'
              }`}>
                {priceStats.changePercent > 0 ? '+' : ''}{priceStats.changePercent.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Price Stats Summary */}
      {priceStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Current</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {formatCurrency(priceStats.currentPrice)}
            </p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
            <p className="text-xs text-green-600 dark:text-green-400">30-Day Low</p>
            <p className="text-lg font-bold text-green-700 dark:text-green-300">
              {formatCurrency(priceStats.lowPrice)}
            </p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
            <p className="text-xs text-orange-600 dark:text-orange-400">30-Day High</p>
            <p className="text-lg font-bold text-orange-700 dark:text-orange-300">
              {formatCurrency(priceStats.highPrice)}
            </p>
          </div>
          <div className={`rounded-lg p-3 ${
            priceStats.trend === 'up' ? 'bg-red-50 dark:bg-red-900/20' :
            priceStats.trend === 'down' ? 'bg-green-50 dark:bg-green-900/20' :
            'bg-gray-50 dark:bg-gray-700'
          }`}>
            <p className={`text-xs ${
              priceStats.trend === 'up' ? 'text-red-600 dark:text-red-400' :
              priceStats.trend === 'down' ? 'text-green-600 dark:text-green-400' :
              'text-gray-500 dark:text-gray-400'
            }`}>
              30-Day Change
            </p>
            <p className={`text-lg font-bold ${
              priceStats.trend === 'up' ? 'text-red-700 dark:text-red-300' :
              priceStats.trend === 'down' ? 'text-green-700 dark:text-green-300' :
              'text-gray-700 dark:text-gray-300'
            }`}>
              {formatCurrency(Math.abs(priceStats.change))}
            </p>
          </div>
        </div>
      )}

      <div className="h-64 md:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-600" />
            <XAxis 
              dataKey="formatted_day" 
              tick={{ fill: '#6b7280', fontSize: 12 }}
              axisLine={{ stroke: '#d1d5db' }}
              className="dark:stroke-gray-600"
            />
            <YAxis 
              tickFormatter={(value) => formatCurrency(value, 'USD').split('.')[0]}
              tick={{ fill: '#6b7280', fontSize: 12 }}
              axisLine={{ stroke: '#d1d5db' }}
              className="dark:stroke-gray-600"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            {/* Price range area */}
            <Area
              type="monotone"
              dataKey="high_price"
              stackId="1"
              stroke="none"
              fill="#fbbf24"
              fillOpacity={0.1}
              name="Price Range"
            />
            <Area
              type="monotone"
              dataKey="low_price"
              stackId="1"
              stroke="none"
              fill="#ffffff"
              fillOpacity={1}
            />
            
            {/* Average price line */}
            <Line 
              type="monotone" 
              dataKey="avg_price" 
              name="Average Price" 
              stroke="#3b82f6" 
              strokeWidth={3}
              dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, fill: '#1e40af', strokeWidth: 2, stroke: '#fff' }}
            />
            
            {/* High/Low lines */}
            <Line 
              type="monotone" 
              dataKey="high_price" 
              name="Daily High" 
              stroke="#f59e0b" 
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="low_price" 
              name="Daily Low" 
              stroke="#10b981" 
              strokeWidth={1}
              strokeDasharray="5 5"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        Based on eBay listings tracked over the past 30 days. Shows daily low, high, and average prices.
      </p>
    </div>
  );
};

export default PriceHistoryChart;