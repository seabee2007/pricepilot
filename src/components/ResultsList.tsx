import { useState } from 'react';
import { ItemSummary, SearchMode } from '../types';
import { formatCurrency, truncateText, getConditionName } from '../lib/utils';
import { ArrowUp, ArrowDown, ExternalLink, BookmarkPlus, Truck, Shield } from 'lucide-react';
import Button from './ui/Button';
import toast from 'react-hot-toast';

interface ResultsListProps {
  items: ItemSummary[];
  mode: SearchMode;
  onSaveSearch?: () => void;
  isLoading?: boolean;
}

const ResultsList = ({ items, mode, onSaveSearch, isLoading = false }: ResultsListProps) => {
  const [sortField, setSortField] = useState<'price' | 'shipping'>('price');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(mode === 'buy' ? 'asc' : 'desc');

  // 🕵️‍♂️ Debug component props
  console.group('🕵️‍♂️ ResultsList component debug');
  console.log('Items received:', items);
  console.log('Items length:', items?.length || 0);
  console.log('Is loading:', isLoading);
  console.log('Mode:', mode);
  console.log('Items is array?', Array.isArray(items));
  if (items && items.length > 0) {
    console.log('First item in ResultsList:', items[0]);
  }
  console.groupEnd();

  const handleSort = (field: 'price' | 'shipping') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(mode === 'buy' ? 'asc' : 'desc');
    }
  };

  const openEbayListing = (url: string) => {
    window.open(url, '_blank');
  };

  const handleSaveSearch = () => {
    if (onSaveSearch) {
      onSaveSearch();
      toast.success('Search saved successfully!');
    }
  };

  // Sort items
  const sortedItems = [...items].sort((a, b) => {
    if (sortField === 'price') {
      const aPrice = a.price?.value || 0;
      const bPrice = b.price?.value || 0;
      return sortDirection === 'asc' ? aPrice - bPrice : bPrice - aPrice;
    } else {
      const aShipping = a.shippingOptions?.[0]?.shippingCost?.value || 0;
      const bShipping = b.shippingOptions?.[0]?.shippingCost?.value || 0;
      return sortDirection === 'asc' ? aShipping - bShipping : bShipping - aShipping;
    }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 dark:border-blue-500"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Searching eBay for the best prices...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400 text-lg">No results found. Try a different search.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {items.length} {mode === 'buy' ? 'Deals' : 'Completed Sales'} Found
        </h2>
        <Button 
          variant="outline"
          onClick={handleSaveSearch}
          icon={<BookmarkPlus className="h-4 w-4" />}
          size="sm"
        >
          Save Search
        </Button>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden mb-8">
        {/* Sort Header */}
        <div className="flex items-center bg-gray-50 dark:bg-gray-900 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          <div className="w-2/5 sm:w-3/5">Item</div>
          <button 
            className={`w-1/5 sm:w-1/5 flex items-center ${sortField === 'price' ? 'text-blue-600 dark:text-blue-400' : ''}`}
            onClick={() => handleSort('price')}
          >
            Price
            {sortField === 'price' && (
              sortDirection === 'asc' ? 
                <ArrowUp className="ml-1 h-3 w-3" /> : 
                <ArrowDown className="ml-1 h-3 w-3" />
            )}
          </button>
          <button 
            className={`w-1/5 sm:w-1/5 flex items-center ${sortField === 'shipping' ? 'text-blue-600 dark:text-blue-400' : ''}`}
            onClick={() => handleSort('shipping')}
          >
            Shipping
            {sortField === 'shipping' && (
              sortDirection === 'asc' ? 
                <ArrowUp className="ml-1 h-3 w-3" /> : 
                <ArrowDown className="ml-1 h-3 w-3" />
            )}
          </button>
        </div>
        
        {/* Results */}
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {sortedItems.map((item, i) => {
            console.log('🎨 Rendering item', i, item);
            console.log('🎨 Item ID:', item.itemId);
            console.log('🎨 Item title:', item.title);
            console.log('🎨 Item price:', item.price);
            
            return (
              <div 
                key={item.itemId} 
                className="flex flex-col sm:flex-row hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors duration-150 cursor-pointer"
                onClick={() => openEbayListing(item.itemWebUrl)}
              >
                <div className="flex items-center p-4 w-full sm:w-3/5">
                  <div className="flex-shrink-0 h-16 w-16 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                    {item.image?.imageUrl ? (
                      <img 
                        src={item.image.imageUrl} 
                        alt={item.title} 
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-gray-400">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 hover:underline">
                      {truncateText(item.title, 80)}
                    </h3>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {item.condition && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          {item.condition}
                        </span>
                      )}
                      {item.buyingOptions?.includes('FIXED_PRICE') && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                          Buy It Now
                        </span>
                      )}
                      {item.seller && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                          <Shield className="mr-1 h-3 w-3" />
                          {item.seller.feedbackScore || 0} {item.seller.feedbackPercentage && `(${item.seller.feedbackPercentage})`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-row sm:flex-col justify-between p-4 w-full sm:w-1/5">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 sm:mb-1">Price:</div>
                  <div className="text-base font-bold text-gray-900 dark:text-white">
                    {formatCurrency(item.price?.value || 0, item.price?.currency || 'USD')}
                  </div>
                </div>
                <div className="flex flex-row sm:flex-col justify-between p-4 w-full sm:w-1/5">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 sm:mb-1">Shipping:</div>
                  <div className="flex items-center">
                    {item.shippingOptions && item.shippingOptions[0]?.shippingCost?.value === 0 ? (
                      <span className="text-green-600 dark:text-green-400 font-medium flex items-center">
                        <Truck className="mr-1 h-4 w-4" />
                        Free
                      </span>
                    ) : (
                      <span className="text-gray-800 dark:text-gray-200">
                        {item.shippingOptions && item.shippingOptions[0]?.shippingCost
                          ? formatCurrency(item.shippingOptions[0].shippingCost.value, item.shippingOptions[0].shippingCost.currency)
                          : 'Not specified'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ResultsList;