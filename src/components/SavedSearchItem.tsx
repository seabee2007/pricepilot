import { formatCurrency } from '../lib/utils';
import { SavedSearch } from '../types';
import { format } from 'date-fns';
import { Trash2, Bell, DollarSign, TrendingUp, Activity } from 'lucide-react';
import Button from './ui/Button';
import PriceHistoryChart from './PriceHistoryChart';
import toast from 'react-hot-toast';

interface SavedSearchItemProps {
  savedSearch: SavedSearch;
  onDelete: (id: string) => void;
}

const SavedSearchItem = ({ savedSearch, onDelete }: SavedSearchItemProps) => {
  const handleDelete = () => {
    onDelete(savedSearch.id);
    toast.success('Search deleted successfully');
  };

  // Format filters for display
  const formatFilters = () => {
    const filters = [];
    
    if (savedSearch.filters.conditionIds?.length) {
      const conditions = savedSearch.filters.conditionIds.map(id => {
        switch (id) {
          case 1000: return 'New';
          case 2000: return 'Refurbished';
          case 3000: return 'Used';
          default: return 'Unknown';
        }
      });
      filters.push(`Condition: ${conditions.join(', ')}`);
    }
    
    if (savedSearch.filters.freeShipping) {
      filters.push('Free Shipping');
    }
    
    if (savedSearch.filters.buyItNowOnly) {
      filters.push('Buy It Now Only');
    }
    
    if (savedSearch.filters.sellerLocation) {
      filters.push(`Location: ${savedSearch.filters.sellerLocation}`);
    }
    
    return filters.length ? filters.join(' • ') : 'No filters';
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden transition-all hover:shadow-md">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{savedSearch.query}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {formatFilters()}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            icon={<Trash2 className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Price Alert Info */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex items-center text-gray-700 dark:text-gray-300">
            <Bell className="h-4 w-4 mr-2 text-blue-500 dark:text-blue-400" />
            <div>
              <div className="text-sm">Alert when price drops below</div>
              <div className="font-semibold">
                {formatCurrency(savedSearch.price_threshold)}
              </div>
            </div>
          </div>
          <div className="flex items-center text-gray-700 dark:text-gray-300">
            <DollarSign className="h-4 w-4 mr-2 text-green-500 dark:text-green-400" />
            <div>
              <div className="text-sm">Last checked price</div>
              <div className="font-semibold">
                {savedSearch.last_checked_price 
                  ? formatCurrency(savedSearch.last_checked_price)
                  : 'Not checked yet'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 30-Day Price History Sparkline */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
            <TrendingUp className="h-4 w-4 mr-2" />
            30-Day Price Trend
          </h4>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Created {format(new Date(savedSearch.created_at), 'MMM d, yyyy')}
          </div>
        </div>
        
        {/* Compact sparkline chart */}
        <PriceHistoryChart 
          query={savedSearch.query}
          searchId={savedSearch.id}
          showSparkline={true}
          className="border-0 shadow-none p-0 bg-transparent"
        />
      </div>
    </div>
  );
};

export default SavedSearchItem;