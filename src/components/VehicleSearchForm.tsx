import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Search, ChevronDown, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './ui/Button';
import { SearchFilters, SearchMode } from '../types';
import { getVehicleAspects, VehicleAspects, refreshVehicleAspects, getModelsForMake } from '../lib/ebay-vehicle';
import toast from 'react-hot-toast';

interface VehicleSearchFormProps {
  mode: SearchMode;
  onSearch?: (query: string, filters: SearchFilters) => void;
  onBack?: () => void;
  // Add props to preserve user inputs when returning from results
  initialMake?: string;
  initialModel?: string;
  initialYear?: string;
  initialYearRange?: { from: string; to: string };
  initialPriceRange?: { min: string; max: string };
  initialCondition?: number[];
  initialFreeShipping?: boolean;
  initialBuyItNowOnly?: boolean;
}

const VehicleSearchForm = ({ 
  mode, 
  onSearch, 
  onBack,
  initialMake = '',
  initialModel = '',
  initialYear = '',
  initialYearRange = { from: '', to: '' },
  initialPriceRange = { min: '', max: '' },
  initialCondition = [],
  initialFreeShipping = false,
  initialBuyItNowOnly = false
}: VehicleSearchFormProps) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAspects, setLoadingAspects] = useState(false);
  const [refreshingAspects, setRefreshingAspects] = useState(false);
  
  // Vehicle selection state - initialize with passed values
  const [selectedMake, setSelectedMake] = useState(initialMake);
  const [selectedModel, setSelectedModel] = useState(initialModel);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [yearRange, setYearRange] = useState(initialYearRange);
  
  // Available options from eBay API
  const [vehicleAspects, setVehicleAspects] = useState<VehicleAspects>({
    makes: [],
    models: [],
    years: []
  });
  
  // Additional filters - initialize with passed values
  const [priceRange, setPriceRange] = useState(initialPriceRange);
  const [condition, setCondition] = useState<number[]>(initialCondition);
  const [freeShipping, setFreeShipping] = useState(initialFreeShipping);
  const [buyItNowOnly, setBuyItNowOnly] = useState(initialBuyItNowOnly);

  // Load vehicle aspects on component mount
  useEffect(() => {
    const loadAspects = async () => {
      setLoadingAspects(true);
      try {
        console.log('Loading vehicle aspects...');
        const aspects = await getVehicleAspects();
        console.log('Vehicle aspects loaded:', {
          makes: aspects.makes.length,
          models: aspects.models.length,
          years: aspects.years.length
        });
        setVehicleAspects(aspects);
      } catch (error) {
        console.error('Error loading vehicle aspects:', error);
        toast.error('Failed to load vehicle options. Using fallback data.');
      } finally {
        setLoadingAspects(false);
      }
    };

    loadAspects();
  }, []);

  // Handle refresh of vehicle aspects
  const handleRefreshAspects = async () => {
    setRefreshingAspects(true);
    try {
      console.log('Refreshing vehicle aspects...');
      const aspects = await refreshVehicleAspects();
      setVehicleAspects(aspects);
      toast.success('Vehicle data refreshed successfully!');
    } catch (error) {
      console.error('Error refreshing vehicle aspects:', error);
      toast.error('Failed to refresh vehicle data');
    } finally {
      setRefreshingAspects(false);
    }
  };

  // Get available models based on selected make
  const availableModels = getModelsForMake(vehicleAspects, selectedMake);

  // Handle make selection change
  const handleMakeChange = (make: string) => {
    setSelectedMake(make);
    setSelectedModel(''); // Reset model when make changes
    
    // Log available models for debugging
    const models = getModelsForMake(vehicleAspects, make);
    console.log(`Selected make: ${make}, Available models: ${models.length}`);
    if (models.length > 0) {
      console.log('Sample models:', models.slice(0, 5).map(m => m.displayName));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedMake && !selectedModel && !selectedYear && !yearRange.from) {
      toast.error('Please select at least one vehicle criteria');
      return;
    }
    
    setIsLoading(true);
    
    // Build search query - ENHANCED to ensure we get actual vehicles
    const queryParts = [];
    if (selectedMake) queryParts.push(selectedMake);
    if (selectedModel) queryParts.push(selectedModel);
    if (selectedYear) queryParts.push(selectedYear);
    
    // Add strong vehicle-specific terms and exclusions
    const vehicleTerms = ['vehicle', 'automobile', 'car', 'truck', 'motor'];
    const exclusions = [
      '-toy', '-toys', '-model', '-models', '-diecast', '-die-cast',
      '-matchbox', '-hotwheels', '-hot-wheels', '-miniature', '-scale',
      '-parts', '-part', '-accessory', '-accessories', '-component',
      '-keychain', '-poster', '-manual', '-book', '-shirt', '-decal', 
      '-sticker', '-emblem', '-badge', '-collectible', '-memorabilia',
      '-remote', '-control', '-rc', '-plastic', '-metal', '-replica',
      '-figurine', '-action', '-figure', '-kit', '-repair', '-maintenance'
    ];
    
    const query = [...queryParts, ...vehicleTerms, ...exclusions].join(' ');
    
    // Build filters object with enhanced vehicle filtering
    const filters: SearchFilters = {
      category: 'motors', // Cars & Trucks category
      conditionIds: condition,
      freeShipping,
      buyItNowOnly,
      // Vehicle-specific filters with stronger category enforcement
      vehicleAspects: {
        make: selectedMake,
        model: selectedModel,
        year: selectedYear,
        yearFrom: yearRange.from,
        yearTo: yearRange.to
      },
      // Price range filter
      priceRange: (priceRange.min || priceRange.max) ? {
        min: priceRange.min ? parseFloat(priceRange.min) : undefined,
        max: priceRange.max ? parseFloat(priceRange.max) : undefined,
        currency: 'USD'
      } : undefined,
      // Enhanced filters to ensure we get actual vehicles
      searchInDescription: false, // Don't search descriptions to avoid parts/accessories
      sellerAccountType: 'BUSINESS', // Prefer business sellers for actual vehicles
      returnsAccepted: true // Actual vehicle sellers typically accept returns
    };
    
    // Convert filters to URL-friendly format
    const filtersParam = encodeURIComponent(JSON.stringify(filters));
    
    // Navigate to results page with the correct mode and preserve search state
    const searchParams = new URLSearchParams({
      mode,
      q: query,
      filters: filtersParam,
      // Add vehicle search state to URL for back navigation
      vehicleSearch: 'true',
      make: selectedMake,
      model: selectedModel,
      year: selectedYear,
      yearFrom: yearRange.from,
      yearTo: yearRange.to,
      priceMin: priceRange.min,
      priceMax: priceRange.max,
      condition: condition.join(','),
      freeShipping: freeShipping.toString(),
      buyItNowOnly: buyItNowOnly.toString()
    });
    
    navigate(`/results?${searchParams.toString()}`);
    
    if (onSearch) {
      onSearch(query, filters);
    }
  };

  const handleConditionChange = (conditionId: number) => {
    setCondition(prev => 
      prev.includes(conditionId)
        ? prev.filter(id => id !== conditionId)
        : [...prev, conditionId]
    );
  };

  const clearForm = () => {
    setSelectedMake('');
    setSelectedModel('');
    setSelectedYear('');
    setYearRange({ from: '', to: '' });
    setPriceRange({ min: '', max: '' });
    setCondition([]);
    setFreeShipping(false);
    setBuyItNowOnly(false);
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header with back button - color based on mode */}
      <div className={`${mode === 'buy' ? 'bg-blue-800 dark:bg-blue-700' : 'bg-green-800 dark:bg-green-700'} p-4 text-white text-center rounded-t-lg`}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className={`flex items-center ${mode === 'buy' ? 'text-blue-200 hover:text-white' : 'text-green-200 hover:text-white'} transition-colors`}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Categories
          </button>
          <h2 className="text-xl font-semibold flex-1">
            {mode === 'buy' ? 'Find Cars & Trucks to Buy' : 'Price Your Vehicle to Sell'}
          </h2>
          <button
            type="button"
            onClick={handleRefreshAspects}
            disabled={refreshingAspects || loadingAspects}
            className={`flex items-center ${mode === 'buy' ? 'text-blue-200 hover:text-white' : 'text-green-200 hover:text-white'} transition-colors disabled:opacity-50`}
            title="Refresh vehicle data"
          >
            <RefreshCw className={`h-4 w-4 ${refreshingAspects ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-b-lg shadow-md p-6">
        {/* Vehicle Search Description */}
        <div className={`mb-6 p-4 ${mode === 'buy' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'} border rounded-lg`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Car className={`h-5 w-5 ${mode === 'buy' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'} mr-2`} />
              <p className={`${mode === 'buy' ? 'text-blue-800 dark:text-blue-200' : 'text-green-800 dark:text-green-200'} text-sm`}>
                {mode === 'buy' 
                  ? 'Search for actual driveable vehicles in eBay\'s Cars & Trucks category. Results automatically exclude toys, models, parts, and accessories.'
                  : 'Find completed sales of similar vehicles to help price your car or truck for sale. Only real vehicle sales data.'
                }
              </p>
            </div>
            {vehicleAspects.makes.length > 0 && (
              <div className={`text-xs ${mode === 'buy' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
                {vehicleAspects.makes.length} makes • {vehicleAspects.models.length} models • {vehicleAspects.years.length} years
              </div>
            )}
          </div>
        </div>

        {(loadingAspects || refreshingAspects) && (
          <div className={`mb-6 p-4 ${mode === 'buy' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'} border rounded-lg`}>
            <div className="flex items-center">
              <Loader2 className={`h-5 w-5 animate-spin ${mode === 'buy' ? 'text-blue-600' : 'text-green-600'} mr-2`} />
              <span className={`${mode === 'buy' ? 'text-blue-800 dark:text-blue-200' : 'text-green-800 dark:text-green-200'}`}>
                {refreshingAspects ? 'Refreshing vehicle data from eBay...' : 'Loading vehicle options from eBay...'}
              </span>
            </div>
          </div>
        )}

        {/* Vehicle Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Make */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Make
            </label>
            <div className="relative">
              <select
                value={selectedMake}
                onChange={(e) => handleMakeChange(e.target.value)}
                disabled={loadingAspects || refreshingAspects}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white appearance-none disabled:opacity-50"
              >
                <option value="">Any Make</option>
                {vehicleAspects.makes.map((make) => (
                  <option key={make.value} value={make.value}>
                    {make.displayName} ({make.count.toLocaleString()})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Model {selectedMake && `(${availableModels.length} available)`}
            </label>
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={loadingAspects || refreshingAspects}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white appearance-none disabled:opacity-50"
              >
                <option value="">Any Model</option>
                {availableModels.map((model) => (
                  <option key={`${model.value}-${model.make || 'generic'}`} value={model.value}>
                    {model.displayName} ({model.count.toLocaleString()})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
            {selectedMake && availableModels.length === 0 && (
              <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                No specific models found for {selectedMake}. Showing all models.
              </p>
            )}
            {selectedMake && availableModels.length > 0 && (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                Showing {availableModels.length} models for {selectedMake}
              </p>
            )}
          </div>

          {/* Year */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Year
            </label>
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                disabled={loadingAspects || refreshingAspects}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white appearance-none disabled:opacity-50"
              >
                <option value="">Any Year</option>
                {vehicleAspects.years.map((year) => (
                  <option key={year.value} value={year.value}>
                    {year.displayName} ({year.count.toLocaleString()})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Year Range (Alternative to single year) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Year Range (Optional - alternative to single year)
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <input
                type="number"
                placeholder="From (e.g., 2010)"
                value={yearRange.from}
                onChange={(e) => setYearRange(prev => ({ ...prev, from: e.target.value }))}
                min="1900"
                max={new Date().getFullYear()}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <input
                type="number"
                placeholder="To (e.g., 2020)"
                value={yearRange.to}
                onChange={(e) => setYearRange(prev => ({ ...prev, to: e.target.value }))}
                min="1900"
                max={new Date().getFullYear()}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Price Range */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Price Range
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <input
                type="number"
                placeholder="Min Price"
                value={priceRange.min}
                onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <input
                type="number"
                placeholder="Max Price"
                value={priceRange.max}
                onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Condition Filters */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Condition
          </label>
          <div className="flex flex-wrap gap-4">
            {[
              { id: 1000, label: 'New' },
              { id: 3000, label: 'Used' },
              { id: 2000, label: 'Certified Pre-Owned' }
            ].map(conditionOption => (
              <label key={conditionOption.id} className="flex items-center">
                <input
                  type="checkbox"
                  checked={condition.includes(conditionOption.id)}
                  onChange={() => handleConditionChange(conditionOption.id)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  {conditionOption.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Additional Options */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Additional Options
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={freeShipping}
                onChange={(e) => setFreeShipping(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Free Shipping
              </span>
            </label>
            {mode === 'buy' && (
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={buyItNowOnly}
                  onChange={(e) => setBuyItNowOnly(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Buy It Now Only
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={clearForm}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear All
          </button>
          
          <Button
            type="submit"
            disabled={isLoading || loadingAspects || refreshingAspects}
            isLoading={isLoading}
            className={`px-8 py-3 ${mode === 'buy' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'} text-white font-semibold`}
            icon={<Search className="h-5 w-5" />}
          >
            {mode === 'buy' ? 'Search Vehicles' : 'Find Sold Vehicles'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default VehicleSearchForm;