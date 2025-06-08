import { formatCurrency } from '../lib/utils';
import { SavedItem, SavedItemIndividual, SavedItemSearch } from '../types';
import { format } from 'date-fns';
import { Trash2, Bell, DollarSign, TrendingUp, Activity, ExternalLink, Package, Search } from 'lucide-react';
import Button from './ui/Button';
import PriceHistoryChart from './PriceHistoryChart';
import toast from 'react-hot-toast';

interface SavedItemCardProps {
  savedItem: SavedItem;
  onDelete: (id: string) => void;
}

const SavedItemCard = ({ savedItem, onDelete }: SavedItemCardProps) => {
  const handleDelete = () => {
    onDelete(savedItem.id);
    const itemType = savedItem.item_type === 'item' ? 'item' : 'search';
    toast.success(`Saved ${itemType} deleted successfully`);
  };

  // Type guards
  const isIndividualItem = (item: SavedItem): item is SavedItemIndividual => {
    return item.item_type === 'item';
  };

  const isSearchQuery = (item: SavedItem): item is SavedItemSearch => {
    return item.item_type === 'search';
  };

  // Format filters for search items
  const formatFilters = (filters: any) => {
    const filterArray = [];
    
    if (filters?.conditionIds?.length) {
      const conditions = filters.conditionIds.map((id: number) => {
        switch (id) {
          case 1000: return 'New';
          case 2000: return 'Refurbished';
          case 3000: return 'Used';
          default: return 'Unknown';
        }
      });
      filterArray.push(`Condition: ${conditions.join(', ')}`);
    }
    
    if (filters?.freeShipping) {
      filterArray.push('Free Shipping');
    }
    
    if (filters?.buyItNowOnly) {
      filterArray.push('Buy It Now Only');
    }
    
    if (filters?.sellerLocation) {
      filterArray.push(`Location: ${filters.sellerLocation}`);
    }
    
    return filterArray.length ? filterArray.join(' • ') : 'No filters';
  };

  // Render individual item
  if (isIndividualItem(savedItem)) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden transition-all hover:shadow-md">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start">
            <div className="flex gap-4 flex-1">
              {savedItem.image_url && (
                <img 
                  src={savedItem.image_url} 
                  alt={savedItem.title}
                  className="w-[90px] h-[90px] sm:w-[106px] sm:h-[106px] md:w-[120px] md:h-[120px] lg:w-[140px] lg:h-[140px] object-cover rounded-lg flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="h-4 w-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Individual Item</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
                  {savedItem.title}
                </h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-semibold text-lg text-gray-900 dark:text-white">
                    {formatCurrency(savedItem.price, savedItem.currency)}
                  </span>
                  {savedItem.condition && (
                    <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                      {savedItem.condition}
                    </span>
                  )}
                </div>
                {savedItem.seller_username && (
                  <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Seller: {savedItem.seller_username}
                    {savedItem.seller_feedback_percentage && (
                      <span className="ml-2">({savedItem.seller_feedback_percentage})</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {savedItem.item_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(savedItem.item_url, '_blank')}
                  className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  icon={<ExternalLink className="h-4 w-4" />}
                />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                icon={<Trash2 className="h-4 w-4" />}
              />
            </div>
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
                  {savedItem.price_alert_threshold 
                    ? formatCurrency(savedItem.price_alert_threshold)
                    : 'Not set'}
                </div>
              </div>
            </div>
            <div className="flex items-center text-gray-700 dark:text-gray-300">
              <DollarSign className="h-4 w-4 mr-2 text-green-500 dark:text-green-400" />
              <div>
                <div className="text-sm">Last checked price</div>
                <div className="font-semibold">
                  {savedItem.last_checked_price 
                    ? formatCurrency(savedItem.last_checked_price)
                    : 'Not checked yet'}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 self-end">
              Saved {format(new Date(savedItem.created_at), 'MMM d, yyyy')}
            </div>
          </div>
        </div>

        {/* Notes section if present */}
        {savedItem.notes && (
          <div className="p-4 bg-gray-50 dark:bg-gray-700">
            <p className="text-sm text-gray-700 dark:text-gray-300">{savedItem.notes}</p>
          </div>
        )}
      </div>
    );
  }

  // Render search query
  if (isSearchQuery(savedItem)) {
    return (
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden transition-all hover:shadow-md">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-4 w-4 text-green-500 dark:text-green-400 flex-shrink-0" />
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">Saved Search</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{savedItem.search_query}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {formatFilters(savedItem.search_filters)}
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
                  {savedItem.price_alert_threshold 
                    ? formatCurrency(savedItem.price_alert_threshold)
                    : 'Not set'}
                </div>
              </div>
            </div>
            <div className="flex items-center text-gray-700 dark:text-gray-300">
              <DollarSign className="h-4 w-4 mr-2 text-green-500 dark:text-green-400" />
              <div>
                <div className="text-sm">Last checked price</div>
                <div className="font-semibold">
                  {savedItem.last_checked_price 
                    ? formatCurrency(savedItem.last_checked_price)
                    : 'Not checked yet'}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 self-end">
              Created {format(new Date(savedItem.created_at), 'MMM d, yyyy')}
            </div>
          </div>
        </div>

        {/* 30-Day Price History Sparkline for search queries */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              30-Day Price Trend
            </h4>
          </div>
          
          {/* Compact sparkline chart */}
          <PriceHistoryChart 
            query={savedItem.search_query}
            searchId={savedItem.id}
            showSparkline={true}
            className="border-0 shadow-none p-0 bg-transparent"
          />
        </div>
      </div>
    );
  }

  return null;
};

export default SavedItemCard;