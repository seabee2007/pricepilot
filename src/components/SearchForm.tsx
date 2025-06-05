import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Search, Loader2 } from 'lucide-react';
import Button from './ui/Button';
import { SearchMode, SearchFilters } from '../types';

interface SearchFormProps {
  mode: SearchMode;
}

const SearchForm = ({ mode }: SearchFormProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // Filter states
  const [conditionIds, setConditionIds] = useState<number[]>([]);
  const [freeShipping, setFreeShipping] = useState(false);
  const [sellerLocation, setSellerLocation] = useState('');
  const [buyItNowOnly, setBuyItNowOnly] = useState(false);
  const [postalCode, setPostalCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    // Build filters object
    const filters: SearchFilters = {};
    
    if (conditionIds.length > 0) {
      filters.conditionIds = conditionIds;
    }
    
    if (freeShipping) {
      filters.freeShipping = true;
    }
    
    if (sellerLocation) {
      filters.sellerLocation = sellerLocation;
    }
    
    if (buyItNowOnly) {
      filters.buyItNowOnly = true;
    }
    
    if (mode === 'buy' && postalCode) {
      filters.postalCode = postalCode;
    }
    
    // Convert filters to URL-friendly format
    const filtersParam = encodeURIComponent(JSON.stringify(filters));
    
    // Navigate to results page
    navigate(`/results?mode=${mode}&q=${encodeURIComponent(query)}&filters=${filtersParam}`);
  };

  const handleVoiceSearch = async () => {
    // This is a placeholder for voice search functionality
    // In a real implementation, you would integrate with a voice API
    setIsRecording(true);
    
    try {
      // Simulate voice recognition with a timeout
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Set a sample query
      setQuery('iphone 13 pro max');
      
    } catch (error) {
      console.error('Voice search error:', error);
    } finally {
      setIsRecording(false);
    }
  };

  const handleConditionChange = (conditionId: number) => {
    setConditionIds(prev => 
      prev.includes(conditionId)
        ? prev.filter(id => id !== conditionId)
        : [...prev, conditionId]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto">
      <div className="mb-6 relative">
        <div className="flex">
          <div className="relative flex-grow">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={mode === 'buy' ? "What are you looking to buy?" : "What are you selling?"}
              className="w-full px-4 py-3 pr-12 rounded-l-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:ring-blue-400"
              required
            />
            <button
              type="button"
              onClick={handleVoiceSearch}
              disabled={isRecording}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {isRecording ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>
          </div>
          <Button
            type="submit"
            disabled={!query.trim() || isLoading}
            className={`rounded-l-none ${mode === 'buy' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
            isLoading={isLoading}
            icon={<Search className="h-4 w-4" />}
          >
            Search
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-gray-100">Filters</h3>
        
        <div className="space-y-4">
          {/* Condition Filter */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              Condition
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 1000, label: 'New' },
                { id: 3000, label: 'Used' },
                { id: 2000, label: 'Refurbished' }
              ].map(condition => (
                <label 
                  key={condition.id} 
                  className="flex items-center space-x-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={conditionIds.includes(condition.id)}
                    onChange={() => handleConditionChange(condition.id)}
                    className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{condition.label}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Shipping and Location Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={freeShipping}
                  onChange={() => setFreeShipping(!freeShipping)}
                  className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Free Shipping Only</span>
              </label>
            </div>
            
            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={buyItNowOnly}
                  onChange={() => setBuyItNowOnly(!buyItNowOnly)}
                  className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Buy It Now Only</span>
              </label>
            </div>
          </div>
          
          {/* Location Filter */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
              Seller Location
            </label>
            <select
              value={sellerLocation}
              onChange={(e) => setSellerLocation(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            >
              <option value="">Any Location</option>
              <option value="US">United States</option>
              <option value="CA">Canada</option>
              <option value="UK">United Kingdom</option>
              <option value="AU">Australia</option>
            </select>
          </div>
          
          {/* Postal Code (Buy Mode Only) */}
          {mode === 'buy' && (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Your Postal Code (optional)
              </label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="For local pickup & delivery estimates"
                className="w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              />
            </div>
          )}
        </div>
      </div>
    </form>
  );
};

export default SearchForm;