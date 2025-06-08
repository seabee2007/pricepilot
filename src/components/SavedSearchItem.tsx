import React from 'react';
import { SavedItem, SavedItemIndividual } from '../types';
import { ExternalLink, Trash2, Package } from 'lucide-react';
import Button from './ui/Button';
import toast from 'react-hot-toast';
import PriceHistoryChart from './PriceHistoryChart';

interface SavedItemCardProps {
  savedItem: SavedItem;
  onDelete: (id: string) => void;
}

const SavedItemCard = ({ savedItem, onDelete }: SavedItemCardProps) => {
  const handleDelete = () => {
    onDelete(savedItem.id);
    toast.success('Saved item deleted successfully');
  };

  // Type guard for individual items
  const isIndividualItem = (item: SavedItem): item is SavedItemIndividual => {
    return item.item_type === 'item';
  };

  // Only render individual items now
  if (!isIndividualItem(savedItem)) {
    return null; // Don't render search queries anymore
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden transition-all hover:shadow-md">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Saved Item</span>
            </div>
            <div className="flex gap-4">
              {savedItem.image_url && (
                <img 
                  src={savedItem.image_url} 
                  alt={savedItem.title}
                  className="w-[90px] h-[90px] sm:w-[106px] sm:h-[106px] md:w-[120px] md:h-[120px] lg:w-[140px] lg:h-[140px] object-cover rounded-lg flex-shrink-0"
                />
              )}
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{savedItem.title}</h3>
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <p><strong className="text-gray-900 dark:text-gray-100">${savedItem.price?.toFixed(2)} {savedItem.currency}</strong></p>
                  {savedItem.condition && <p>Condition: {savedItem.condition}</p>}
                  {savedItem.seller_username && (
                    <p>Seller: {savedItem.seller_username} 
                      {savedItem.seller_feedback_percentage && ` (${savedItem.seller_feedback_percentage})`}
                    </p>
                  )}
                  {savedItem.shipping_cost && savedItem.shipping_cost > 0 && (
                    <p>Shipping: ${savedItem.shipping_cost.toFixed(2)} {savedItem.shipping_currency}</p>
                  )}
                </div>
              </div>
            </div>
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
      {savedItem.price_alert_threshold && (
        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Price Alert: ${savedItem.price_alert_threshold.toFixed(2)}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                You'll be notified when the price drops below this threshold
              </p>
            </div>
            {savedItem.last_checked_price && (
              <div className="text-right">
                <p className="text-xs text-blue-600 dark:text-blue-400">Last checked</p>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  ${savedItem.last_checked_price.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Price History Chart */}
      {savedItem.item_id && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">30-Day Price History</h4>
          <PriceHistoryChart query={savedItem.title || ''} searchId={savedItem.id} />
        </div>
      )}

      {/* Actions */}
      <div className="p-4 flex justify-between items-center">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Saved {new Date(savedItem.created_at).toLocaleDateString()}
        </div>
        <a
          href={savedItem.item_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          <ExternalLink className="h-4 w-4" />
          View on eBay
        </a>
      </div>
    </div>
  );
};

export default SavedItemCard;