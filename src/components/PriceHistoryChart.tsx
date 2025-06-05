import { PriceHistory } from '../types';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface PriceHistoryChartProps {
  data: PriceHistory[];
  query: string;
}

const PriceHistoryChart = ({ data, query }: PriceHistoryChartProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Price History</h2>
        <p className="text-gray-600 dark:text-gray-400">No price history data available for this search.</p>
      </div>
    );
  }

  // Format data for the chart
  const chartData = data.map(item => ({
    date: format(new Date(item.timestamp), 'MMM dd'),
    price: item.avg_price,
    timestamp: item.timestamp,
  }));

  // Calculate min and max prices for y-axis domain
  const prices = data.map(item => item.avg_price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  // Add 10% padding to min and max
  const yAxisMin = Math.max(0, minPrice * 0.9);
  const yAxisMax = maxPrice * 1.1;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 shadow-lg rounded">
          <p className="text-gray-700 dark:text-gray-300 font-medium">{format(new Date(payload[0].payload.timestamp), 'MMM dd, yyyy')}</p>
          <p className="text-blue-600 dark:text-blue-400 font-bold">
            Average Price: {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Price History for "{query}"
      </h2>
      <div className="h-64 md:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              tick={{ fill: '#6b7280', fontSize: 12 }}
              axisLine={{ stroke: '#d1d5db' }}
            />
            <YAxis 
              tickFormatter={(value) => formatCurrency(value, 'USD').split('.')[0]}
              domain={[yAxisMin, yAxisMax]}
              tick={{ fill: '#6b7280', fontSize: 12 }}
              axisLine={{ stroke: '#d1d5db' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="price" 
              name="Average Price" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, fill: '#1e40af', strokeWidth: 2, stroke: '#fff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        Based on completed eBay listings over the past 30 days
      </p>
    </div>
  );
};

export default PriceHistoryChart;