import { useState } from 'react';
import { formatCurrency } from '../lib/utils';
import { SavedItem } from '../types';
import { format } from 'date-fns';
import { Trash2, ExternalLink, Edit3, Save, X, Bell, BellOff, TrendingDown, TrendingUp } from 'lucide-react';
import Button from './ui/Button';
import toast from 'react-hot-toast';

interface SavedItemCardProps {
  savedItem: SavedItem;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: { notes?: string; priceAlertThreshold?: number }) => void;
}

const SavedItemCard = ({ savedItem, onDelete, onUpdate }: SavedItemCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(savedItem.notes || '');
  const [priceAlert, setPriceAlert] = useState(savedItem.price_alert_threshold || '');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (isDeleting) return;
    
    if (window.confirm('Are you sure you want to remove this item from your saved items?')) {
      setIsDeleting(true);
      try {
        await onDelete(savedItem.id);
      } catch (error) {
        setIsDeleting(false);
      }
    }
  };

  const handleSave = async () => {
    try {
      const updates: { notes?: string; priceAlertThreshold?: number } = {};
      
      if (notes !== (savedItem.notes || '')) {
        updates.notes = notes;
      }
      
      const alertThreshold = priceAlert ? parseFloat(priceAlert.toString()) : undefined;
      if (alertThreshold !== savedItem.price_alert_threshold) {
        updates.priceAlertThreshold = alertThreshold;
      }

      if (Object.keys(updates).length > 0) {
        await onUpdate(savedItem.id, updates);
      }
      
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleCancel = () => {
    setNotes(savedItem.notes || '');
    setPriceAlert(savedItem.price_alert_threshold || '');
    setIsEditing(false);
  };

  const openEbayListing = () => {
    window.open(savedItem.item_url, '_blank');
  };

  // Calculate price change
  const priceChange = savedItem.last_checked_price && savedItem.last_checked_price !== savedItem.price
    ? savedItem.last_checked_price - savedItem.price
    : null;

  const hasActiveAlert = savedItem.price_alert_threshold && savedItem.price <= savedItem.price_alert_threshold;

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden transition-all hover:shadow-md">
      {/* Item Image and Basic Info */}
      <div className="relative">
        {savedItem.image_url ? (
          <img
            src={savedItem.image_url}
            alt={savedItem.title}
            className="w-full h-48 object-cover cursor-pointer"
            onClick={openEbayListing}
          />
        ) : (
          <div 
            className="w-full h-48 bg-gray-100 dark:bg-gray-700 flex items-center justify-center cursor-pointer"
            onClick={openEbayListing}
          >
            <span className="text-gray-400">No Image</span>
          </div>
        )}
        
        {/* Price Alert Badge */}
        {hasActiveAlert && (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center">
            <Bell className="h-3 w-3 mr-1" />
            Price Alert!
          </div>
        )}

        {/* Price Change Badge */}
        {priceChange && (
          <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium flex items-center ${
            priceChange > 0 
              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
          }`}>
            {priceChange > 0 ? (
              <TrendingUp className="h-3 w-3 mr-1" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1" />
            )}
            {formatCurrency(Math.abs(priceChange), savedItem.currency)}
          </div>
        )}
      </div>

      {/* Item Details */}
      <div className="p-4">
        <h3 
          className="text-lg font-medium text-gray-900 dark:text-gray-100 line-clamp-2 cursor-pointer hover:underline mb-2"
          onClick={openEbayListing}
        >
          {savedItem.title}
        </h3>

        {/* Price Information */}
        <div className="flex justify-between items-center mb-3">
          <div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(savedItem.price, savedItem.currency)}
            </div>
            {savedItem.shipping_cost && savedItem.shipping_cost > 0 && (
              <div className="text-sm text-gray-500">
                + {formatCurrency(savedItem.shipping_cost, savedItem.shipping_currency || savedItem.currency)} shipping
              </div>
            )}
          </div>
          
          {savedItem.condition && (
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
              {savedItem.condition}
            </span>
          )}
        </div>

        {/* Seller Information */}
        {savedItem.seller_username && (
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-3">
            <span>Seller: {savedItem.seller_username}</span>
            {savedItem.seller_feedback_score && (
              <span className="ml-2">
                ({savedItem.seller_feedback_score} {savedItem.seller_feedback_percentage})
              </span>
            )}
          </div>
        )}

        {/* Price Alert Section */}
        {!isEditing && savedItem.price_alert_threshold && (
          <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
            <div className="flex items-center text-sm">
              {hasActiveAlert ? (
                <Bell className="h-4 w-4 text-red-500 mr-2" />
              ) : (
                <BellOff className="h-4 w-4 text-blue-500 mr-2" />
              )}
              <span className="text-blue-800 dark:text-blue-200">
                Alert when below {formatCurrency(savedItem.price_alert_threshold, savedItem.currency)}
              </span>
            </div>
          </div>
        )}

        {/* Notes Section */}
        {!isEditing && savedItem.notes && (
          <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded">
            <p className="text-sm text-gray-700 dark:text-gray-300">{savedItem.notes}</p>
          </div>
        )}

        {/* Edit Form */}
        {isEditing && (
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Price Alert Threshold
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={priceAlert}
                  onChange={(e) => setPriceAlert(e.target.value)}
                  placeholder="Set price alert"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Personal Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add your notes about this item..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
          {isEditing ? (
            <div className="flex space-x-2">
              <Button
                size="sm"
                onClick={handleSave}
                icon={<Save className="h-4 w-4" />}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                icon={<X className="h-4 w-4" />}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
                icon={<Edit3 className="h-4 w-4" />}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={openEbayListing}
                icon={<ExternalLink className="h-4 w-4" />}
              >
                View on eBay
              </Button>
            </div>
          )}
          
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            icon={<Trash2 className="h-4 w-4" />}
          />
        </div>

        {/* Saved Date */}
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Saved {format(new Date(savedItem.created_at), 'MMM d, yyyy')}
        </div>
      </div>
    </div>
  );
};

export default SavedItemCard;