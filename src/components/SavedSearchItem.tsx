import React, { useState, useMemo } from 'react';
import { SavedItem, SavedItemIndividual } from '../types';
import { ExternalLink, Trash2, Package, Edit, Check, X, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import Button from './ui/Button';
import { updateSavedItem, parseVehicleFromQuery } from '../lib/supabase';
import toast from 'react-hot-toast';
import { VehicleValue } from '../lib/useVehicleValueMap';
import { formatCurrency, formatDate } from '../lib/utils';

interface SavedItemCardProps {
  savedItem: SavedItem;
  onDelete: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<SavedItem>) => void;
  vehicleValue?: VehicleValue | null;
}

const SavedItemCard = ({ savedItem, onDelete, onUpdate, vehicleValue }: SavedItemCardProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditingAlert, setIsEditingAlert] = useState(false);
  const [alertValue, setAlertValue] = useState(savedItem.price_alert_threshold?.toString() || '');
  
  // Parse vehicle info once and memoize it
  const vehicleInfo = useMemo(() => {
    return parseVehicleFromQuery(savedItem.title || '');
  }, [savedItem.title]);

  const isVehicleItem = vehicleInfo !== null && vehicleValue !== null;

  const handleDelete = () => {
    onDelete(savedItem.id);
    toast.success('Saved item deleted successfully');
  };

  const handleEditAlert = () => {
    setAlertValue(savedItem.price_alert_threshold?.toString() || '');
    setIsEditingAlert(true);
  };

  const handleCancelEdit = () => {
    setAlertValue(savedItem.price_alert_threshold?.toString() || '');
    setIsEditingAlert(false);
  };

  const handleSaveAlert = async () => {
    const numericValue = parseFloat(alertValue);
    
    // Validation
    if (alertValue && (isNaN(numericValue) || numericValue <= 0)) {
      toast.error('Please enter a valid price amount');
      return;
    }

    setIsUpdating(true);
    
    try {
      const updates = {
        price_alert_threshold: alertValue ? numericValue : undefined
      };
      
      await updateSavedItem(savedItem.id, updates);
      
      // Update local state if onUpdate callback is provided
      if (onUpdate) {
        onUpdate(savedItem.id, updates);
      }
      
      setIsEditingAlert(false);
      toast.success(alertValue ? 'Price alert updated!' : 'Price alert removed');
      
    } catch (error) {
      console.error('Error updating price alert:', error);
      toast.error('Failed to update price alert');
    } finally {
      setIsUpdating(false);
    }
  };

  // Type guard for individual items
  const isIndividualItem = (item: SavedItem): item is SavedItemIndividual => {
    return item.item_type === 'item';
  };

  // Only render individual items now
  if (!isIndividualItem(savedItem)) {
    return null; // Don't render search queries anymore
  }

  // Debug logging for development
  if (process.env.NODE_ENV === 'development') {
    console.log('🚗 SavedItemCard Debug:', {
      title: savedItem.title,
      vehicleInfo,
      isVehicleItem,
      vehicleValue
    });
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

      {/* Price Alert Section */}
      <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Price Alert</span>
            </div>
            
            {isEditingAlert ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-blue-600 dark:text-blue-400">$</span>
                <input
                  type="number"
                  value={alertValue}
                  onChange={(e) => setAlertValue(e.target.value)}
                  placeholder="Enter alert price"
                  min="0"
                  step="0.01"
                  className="flex-1 px-2 py-1 text-sm border border-blue-300 dark:border-blue-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveAlert}
                    disabled={isUpdating}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 p-1"
                    icon={<Check className="h-4 w-4" />}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={isUpdating}
                    className="text-gray-500 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/20 p-1"
                    icon={<X className="h-4 w-4" />}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  {savedItem.price_alert_threshold ? (
                    <>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Alert when below: ${savedItem.price_alert_threshold.toFixed(2)}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        You'll be notified when the price drops below this threshold
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      No price alert set. Click to add one.
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEditAlert}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  icon={<Edit className="h-4 w-4" />}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Market Value / Price History Section */}
      {savedItem.item_id && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          {isVehicleItem && vehicleInfo ? (
            <>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Vehicle Market Value</h4>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                {vehicleValue ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        {/* Display enhanced market value data */}
                        {vehicleValue.low !== undefined && vehicleValue.avg !== undefined && vehicleValue.high !== undefined ? (
                          <div className="space-y-1">
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">
                              {formatCurrency(vehicleValue.avg, vehicleValue.currency)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Range: {formatCurrency(vehicleValue.low, vehicleValue.currency)} - {formatCurrency(vehicleValue.high, vehicleValue.currency)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Market Value • {vehicleValue.cached ? 'Cached' : 'Live'} Data
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">
                              {formatCurrency(vehicleValue.avg || 0, vehicleValue.currency)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Market Value • {vehicleValue.cached ? 'Cached' : 'Live'} Data
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <DollarSign className="w-6 h-6 text-green-500 dark:text-green-400" />
                      </div>
                    </div>
                    
                    {/* Comparison with eBay listing price */}
                    {savedItem.price && (
                      <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Your listing price:</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            ${savedItem.price.toFixed(2)}
                          </span>
                        </div>
                        {(() => {
                          // Use average value for comparison
                          const marketValue = vehicleValue.avg || 0;
                          const difference = savedItem.price - marketValue;
                          const percentDiff = (difference / marketValue) * 100;
                          const isGoodDeal = difference < 0; // Below market value is good
                          
                          return (
                            <div className={`flex items-center gap-1 mt-1 ${isGoodDeal ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {isGoodDeal ? (
                                <TrendingDown className="w-4 h-4" />
                              ) : (
                                <TrendingUp className="w-4 h-4" />
                              )}
                              <span className="text-xs font-medium">
                                {isGoodDeal ? '' : '+'}{formatCurrency(Math.abs(difference))} 
                                ({isGoodDeal ? '' : '+'}{percentDiff.toFixed(1)}%) vs avg
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      Data from {vehicleValue.source === 'web_scraping' ? 'AutoTrader, Cars.com, eBay Motors, CarGurus via Web Scraping' : 'RapidAPI'} • Updated: {formatDate(vehicleValue.timestamp)}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">No market value data available</p>
                  </div>
                )}
              </div>
            </>
          ) : vehicleInfo && vehicleInfo.make && vehicleInfo.model && vehicleInfo.year ? (
            <>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Market Value Analysis</h4>
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Vehicle market value not available
                </p>
              </div>
            </>
          ) : (
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Vehicle market value not available
              </p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="p-4 flex justify-between items-center">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Saved {formatDate(savedItem.created_at)}
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