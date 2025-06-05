import { useState } from 'react';
import { X } from 'lucide-react';
import Button from './ui/Button';

interface SaveThresholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (threshold: number) => void;
  currentLowestPrice: number;
}

const SaveThresholdModal = ({ 
  isOpen, 
  onClose, 
  onSave,
  currentLowestPrice
}: SaveThresholdModalProps) => {
  const [threshold, setThreshold] = useState(currentLowestPrice * 0.9); // Default to 90% of lowest price
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(threshold);
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full m-4 overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Save Search with Price Alert</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4">
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Set a price threshold for notifications. You'll be alerted when the price drops below this amount.
            </p>
            
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Price Threshold
            </label>
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 dark:text-gray-400 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="block w-full pl-7 pr-12 py-2 rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="0.00"
                required
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500 dark:text-gray-400 sm:text-sm">USD</span>
              </div>
            </div>
            
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Current lowest price: ${currentLowestPrice.toFixed(2)}
            </p>
          </div>
          
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              Save Search
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SaveThresholdModal;