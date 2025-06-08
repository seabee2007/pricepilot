import { useState } from 'react';
import { ItemSummary, SearchMode } from '../types';
import { formatCurrency, truncateText, getConditionName } from '../lib/utils';
import { ArrowUp, ArrowDown, ExternalLink, BookmarkPlus, Truck, Shield, Heart, HeartOff } from 'lucide-react';
import Button from './ui/Button';
import { saveIndividualItem, checkIfItemSaved, deleteSavedItem, getAllSavedItems } from '../lib/supabase';
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
  const [savedItemIds, setSavedItemIds] = useState<Set<string>>(new Set());
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set());

  // Check which items are already saved when component mounts
  useState(() => {
    const checkSavedItems = async () => {
      try {
        const savedItems = await getAllSavedItems();
        // Filter for individual items only and ensure item_id is not undefined
        const savedIds = new Set(
          savedItems
            .filter(item => item.item_type === 'item' && item.item_id)
            .map(item => item.item_id!)
        );
        setSavedItemIds(savedIds);
      } catch (error) {
        console.error('Error checking saved items:', error);
      }
    };

    if (items.length > 0) {
      checkSavedItems();
    }
  });

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

  const handleSaveSearch = () => {
    if (onSaveSearch) {
      onSaveSearch();
      toast.success('Search saved successfully!');
    }
  };

  const handleSaveItem = async (item: ItemSummary, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent opening eBay listing
    event.preventDefault(); // Prevent default link behavior
    
    if (savingItems.has(item.itemId)) {
      return; // Already saving this item
    }

    setSavingItems(prev => new Set(prev).add(item.itemId));

    try {
      if (savedItemIds.has(item.itemId)) {
        // Item is saved, remove it
        const savedItems = await getAllSavedItems();
        const savedItem = savedItems.find(saved => 
          saved.item_type === 'item' && saved.item_id === item.itemId
        );
        
        if (savedItem) {
          await deleteSavedItem(savedItem.id);
          setSavedItemIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(item.itemId);
            return newSet;
          });
          toast.success('Item removed from saved items');
        }
      } else {
        // Item is not saved, save it
        await saveIndividualItem(item);

        setSavedItemIds(prev => new Set(prev).add(item.itemId));
        toast.success('Item saved successfully!');
      }
    } catch (error: any) {
      console.error('Error saving/removing item:', error);
      if (error.message === 'Item is already saved') {
        toast.error('Item is already in your saved items');
      } else if (error.message === 'User must be logged in to save items') {
        toast.error('Please sign in to save items');
      } else {
        toast.error('Failed to save item. Please try again.');
      }
    } finally {
      setSavingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.itemId);
        return newSet;
      });
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
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleSaveSearch}
            icon={<BookmarkPlus className="h-4 w-4" />}
            size="sm"
          >
            Save Search
          </Button>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden mb-8">
        {/* Sort Header */}
        <div className="flex items-center bg-gray-50 dark:bg-gray-900 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          <div className="w-full sm:w-3/5">Item</div>
          <button 
            className={`hidden sm:flex w-1/5 items-center ${sortField === 'price' ? 'text-blue-600 dark:text-blue-400' : ''}`}
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
            className={`hidden sm:flex w-1/5 items-center ${sortField === 'shipping' ? 'text-blue-600 dark:text-blue-400' : ''}`}
            onClick={() => handleSort('shipping')}
          >
            Shipping
            {sortField === 'shipping' && (
              sortDirection === 'asc' ? 
                <ArrowUp className="ml-1 h-3 w-3" /> : 
                <ArrowDown className="ml-1 h-3 w-3" />
            )}
          </button>
          <div className="hidden sm:block w-16 text-center">Save</div>
        </div>
        
        {/* Results */}
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {sortedItems.map((item, i) => {
            console.log('🎨 Rendering item', i, item);
            console.log('🎨 Item ID:', item.itemId);
            console.log('🎨 Item title:', item.title);
            console.log('🎨 Item price:', item.price);
            
            const isSaved = savedItemIds.has(item.itemId);
            const isSaving = savingItems.has(item.itemId);
            
            return (
              <div 
                key={item.itemId} 
                className="flex flex-col sm:flex-row hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors duration-150"
              >
                {/* Mobile layout: flex row with link and save button separate */}
                <div className="flex sm:contents">
                  <a 
                    href={item.itemWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start p-4 flex-1 sm:w-3/5 cursor-pointer hover:no-underline"
                  >
                    {/* Responsive Image Container */}
                    <div className="flex-shrink-0 h-[90px] w-[90px] sm:h-[106px] sm:w-[106px] md:h-32 md:w-32 lg:h-40 lg:w-40 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden shadow-sm">
                      {item.image?.imageUrl ? (
                        <img 
                          src={item.image.imageUrl} 
                          alt={item.title} 
                          className="h-full w-full object-cover hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-400 text-xs text-center">
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="ml-4 flex-1 min-w-0">
                      <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100 line-clamp-2 hover:underline mb-2">
                        {truncateText(item.title, 80)}
                      </h3>
                      
                      {/* Mobile Price/Shipping Info */}
                      <div className="sm:hidden mb-3 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-gray-900 dark:text-white">
                            {formatCurrency(item.price?.value || 0, item.price?.currency || 'USD')}
                          </span>
                          <div className="flex items-center text-sm">
                            {item.shippingOptions && item.shippingOptions[0]?.shippingCost?.value === 0 ? (
                              <span className="text-green-600 dark:text-green-400 font-medium flex items-center">
                                <Truck className="mr-1 h-4 w-4" />
                                Free Shipping
                              </span>
                            ) : (
                              <span className="text-gray-600 dark:text-gray-400">
                                + {item.shippingOptions && item.shippingOptions[0]?.shippingCost
                                  ? formatCurrency(item.shippingOptions[0].shippingCost.value, item.shippingOptions[0].shippingCost.currency)
                                  : 'shipping'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
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
                  </a>
                  
                  {/* Mobile Save Button - now outside the link */}
                  <div className="sm:hidden flex items-center p-4 pl-0">
                    <button
                      onClick={(e) => handleSaveItem(item, e)}
                      disabled={isSaving}
                      className={`p-2 rounded-full transition-colors ${
                        isSaved 
                          ? 'text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/20' 
                          : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                      } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={isSaved ? 'Remove from saved items' : 'Save this item'}
                    >
                      {isSaving ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                      ) : isSaved ? (
                        <Heart className="h-5 w-5 fill-current" />
                      ) : (
                        <Heart className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Desktop Price Column */}
                <div className="hidden sm:flex flex-col justify-center p-4 w-1/5">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price:</div>
                  <div className="text-base font-bold text-gray-900 dark:text-white">
                    {formatCurrency(item.price?.value || 0, item.price?.currency || 'USD')}
                  </div>
                </div>
                
                {/* Desktop Shipping Column */}
                <div className="hidden sm:flex flex-col justify-center p-4 w-1/5">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shipping:</div>
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
                
                {/* Desktop Save Button */}
                <div className="hidden sm:flex items-center justify-center p-4 w-16">
                  <button
                    onClick={(e) => handleSaveItem(item, e)}
                    disabled={isSaving}
                    className={`p-2 rounded-full transition-colors ${
                      isSaved 
                        ? 'text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/20' 
                        : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                    } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={isSaved ? 'Remove from saved items' : 'Save this item'}
                  >
                    {isSaving ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                    ) : isSaved ? (
                      <Heart className="h-5 w-5 fill-current" />
                    ) : (
                      <Heart className="h-5 w-5" />
                    )}
                  </button>
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