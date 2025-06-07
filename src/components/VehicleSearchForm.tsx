import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Search, ChevronDown, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './ui/Button';
import { SearchFilters, SearchMode } from '../types';
import { getVehicleAspects, VehicleAspects, refreshVehicleAspects, getModelsForMake, getYearsForMakeModel } from '../lib/ebay-vehicle';
import toast from 'react-hot-toast';

interface VehicleSearchFormProps {
  mode: SearchMode;
  onSearch?: (query: string, filters: SearchFilters) => void;
  onBack?: () => void;
}

const VehicleSearchForm = ({ mode, onSearch, onBack }: VehicleSearchFormProps) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAspects, setLoadingAspects] = useState(false);
  const [refreshingAspects, setRefreshingAspects] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingYears, setLoadingYears] = useState(false);
  
  // Vehicle selection state
  const [selectedMake, setSelectedMake] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [yearRange, setYearRange] = useState({ from: '', to: '' });
  
  // Available options from eBay API (cascading)
  const [availableMakes, setAvailableMakes] = useState<VehicleAspects['makes']>([]);
  const [availableModels, setAvailableModels] = useState<VehicleAspects['models']>([]);
  const [availableYears, setAvailableYears] = useState<VehicleAspects['years']>([]);
  
  // Additional filters
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [condition, setCondition] = useState<number[]>([]);
  const [freeShipping, setFreeShipping] = useState(false);
  const [buyItNowOnly, setBuyItNowOnly] = useState(false);

  // Load initial vehicle aspects (makes) on component mount
  useEffect(() => {
    const loadInitialAspects = async () => {
      console.log('🚀 [VehicleSearchForm] Component mounted, loading initial vehicle aspects (makes)...');
      setLoadingAspects(true);
      
      try {
        console.log('📞 [VehicleSearchForm] Calling getVehicleAspects() for initial load...');
        const aspects = await getVehicleAspects(); // No filters = get all makes
        
        console.log('✅ [VehicleSearchForm] Initial vehicle aspects loaded successfully:', {
          makes: aspects.makes.length,
          models: aspects.models.length,
          years: aspects.years.length
        });
        
        // Log sample data to verify real counts
        if (aspects.makes.length > 0) {
          console.log('📊 [VehicleSearchForm] Sample makes with real counts:', 
            aspects.makes.slice(0, 5).map(m => `${m.displayName}(${m.count})`)
          );
        }
        
        setAvailableMakes(aspects.makes);
        // For initial load, we might also get some generic models/years
        setAvailableModels(aspects.models || []);
        setAvailableYears(aspects.years || []);
        
        console.log('💾 [VehicleSearchForm] Initial aspects stored in component state');
      } catch (error) {
        console.error('❌ [VehicleSearchForm] Error loading initial vehicle aspects:', {
          errorType: error?.constructor?.name,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
        
        // Parse error message to show user-friendly info
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        if (errorMessage.includes('eBay internal system') || errorMessage.includes('Internal error')) {
          toast.error('eBay\'s vehicle data is temporarily unavailable. Please try again in a few minutes.');
        } else if (errorMessage.includes('Authentication')) {
          toast.error('Authentication error. Please try refreshing the page.');
        } else {
          toast.error('Unable to load vehicle data from eBay. Please try again later.');
        }
      } finally {
        console.log('🏁 [VehicleSearchForm] Loading initial aspects completed');
        setLoadingAspects(false);
      }
    };

    loadInitialAspects();
  }, []);

  // Handle refresh of vehicle aspects
  const handleRefreshAspects = async () => {
    console.log('🔄 [VehicleSearchForm] User triggered refresh of vehicle aspects');
    setRefreshingAspects(true);
    
    try {
      console.log('📞 [VehicleSearchForm] Calling refreshVehicleAspects...');
      const aspects = await refreshVehicleAspects();
      
      console.log('✅ [VehicleSearchForm] Refresh completed successfully:', {
        makes: aspects.makes.length,
        models: aspects.models.length,
        years: aspects.years.length
      });
      
      setAvailableMakes(aspects.makes);
      setAvailableModels(aspects.models || []);
      setAvailableYears(aspects.years || []);
      
      console.log('💾 [VehicleSearchForm] Refreshed data stored in component state');
      toast.success('Vehicle data refreshed with latest eBay inventory!');
    } catch (error) {
      console.error('❌ [VehicleSearchForm] Error refreshing vehicle aspects:', {
        errorType: error?.constructor?.name,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      
      // Parse error message to show user-friendly info  
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('eBay internal system') || errorMessage.includes('Internal error')) {
        toast.error('eBay\'s servers are temporarily unavailable. Please try again in a few minutes.');
      } else {
        toast.error('Failed to refresh vehicle data from eBay. Please try again later.');
      }
    } finally {
      console.log('🏁 [VehicleSearchForm] Refresh completed');
      setRefreshingAspects(false);
    }
  };

  // Handle make selection change - triggers model loading
  const handleMakeChange = async (make: string) => {
    console.log(`🎯 [VehicleSearchForm] User selected make: "${make}"`);
    console.log('   - Previous make:', selectedMake);
    console.log('   - Previous model:', selectedModel);
    
    setSelectedMake(make);
    setSelectedModel(''); // Reset model when make changes
    setSelectedYear(''); // Reset year when make changes
    setAvailableModels([]); // Clear previous models
    setAvailableYears([]); // Clear previous years
    
    if (!make) {
      console.log('📝 [VehicleSearchForm] Make cleared, resetting to initial state');
      return;
    }
    
    // Load models for the selected make
    console.log('📞 [VehicleSearchForm] Loading models for selected make...');
    setLoadingModels(true);
    
    try {
      const models = await getModelsForMake(make);
      console.log(`✅ [VehicleSearchForm] Found ${models.length} models for make: ${make}`);
      
      if (models.length > 0) {
        console.log('📊 [VehicleSearchForm] Sample models for this make:', 
          models.slice(0, 5).map(m => `${m.displayName} (${m.count})`)
        );
      }
      
      setAvailableModels(models);
    } catch (error) {
      console.error(`❌ [VehicleSearchForm] Error loading models for make ${make}:`, error);
      toast.error(`Failed to load models for ${make}. Please try again.`);
    } finally {
      setLoadingModels(false);
    }
  };

  // Handle model selection change - triggers year loading
  const handleModelChange = async (model: string) => {
    console.log(`🎯 [VehicleSearchForm] User selected model: "${model}"`);
    console.log('   - Current make:', selectedMake);
    console.log('   - Previous model:', selectedModel);
    
    setSelectedModel(model);
    setSelectedYear(''); // Reset year when model changes
    setAvailableYears([]); // Clear previous years
    
    if (!model || !selectedMake) {
      console.log('📝 [VehicleSearchForm] Model cleared or no make selected, resetting years');
      return;
    }
    
    // Load years for the selected make+model
    console.log(`📞 [VehicleSearchForm] Loading years for ${selectedMake} ${model}...`);
    setLoadingYears(true);
    
    try {
      const years = await getYearsForMakeModel(selectedMake, model);
      console.log(`✅ [VehicleSearchForm] Found ${years.length} years for ${selectedMake} ${model}`);
      
      if (years.length > 0) {
        console.log('📊 [VehicleSearchForm] Sample years for this make+model:', 
          years.slice(0, 5).map(y => `${y.displayName} (${y.count})`)
        );
      }
      
      setAvailableYears(years);
    } catch (error) {
      console.error(`❌ [VehicleSearchForm] Error loading years for ${selectedMake} ${model}:`, error);
      toast.error(`Failed to load years for ${selectedMake} ${model}. Please try again.`);
    } finally {
      setLoadingYears(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedMake && !selectedModel && !selectedYear && !yearRange.from) {
      toast.error('Please select at least one vehicle criteria');
      return;
    }
    
    setIsLoading(true);
    
    // Build search query with vehicle-specific terms
    const queryParts = [];
    if (selectedMake) queryParts.push(selectedMake);
    if (selectedModel) queryParts.push(selectedModel);
    if (selectedYear) queryParts.push(selectedYear);
    
    // Add vehicle-specific terms to ensure we get actual vehicles
    queryParts.push('vehicle', 'automobile', 'car', 'truck');
    
    const query = queryParts.join(' ');
    
    // Build filters object with enhanced vehicle filtering
    const filters: SearchFilters = {
      category: 'motors', // Cars & Trucks category
      conditionIds: condition,
      freeShipping,
      buyItNowOnly,
      // Vehicle-specific filters
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
        max: priceRange.max ? parseFloat(priceRange.max) : undefined
      } : undefined
    };

    console.log('🔍 [VehicleSearchForm] Submitting vehicle search:', {
      query,
      filters,
      selectedVehicle: { make: selectedMake, model: selectedModel, year: selectedYear }
    });

    if (onSearch) {
      onSearch(query, filters);
    } else {
      // Navigate to search results using the format expected by ResultsPage
      const searchParams = new URLSearchParams({
        q: query,
        mode: mode, // Add the mode parameter
        filters: JSON.stringify(filters) // Send filters as JSON string like ResultsPage expects
      });
      
      navigate(`/results?${searchParams.toString()}`);
    }
    
    setIsLoading(false);
  };

  const handleConditionChange = (conditionId: number) => {
    setCondition(prev => 
      prev.includes(conditionId) 
        ? prev.filter(id => id !== conditionId)
        : [...prev, conditionId]
    );
  };

  const clearForm = () => {
    console.log('🗑️ [VehicleSearchForm] User cleared form');
    setSelectedMake('');
    setSelectedModel('');
    setSelectedYear('');
    setYearRange({ from: '', to: '' });
    setPriceRange({ min: '', max: '' });
    setCondition([]);
    setFreeShipping(false);
    setBuyItNowOnly(false);
    setAvailableModels([]);
    setAvailableYears([]);
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
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
            title="Refresh vehicle data from eBay Browse API"
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
                  ? 'Search for actual vehicles in eBay\'s Cars & Trucks category using real-time Browse API data.'
                  : 'Find completed sales of similar vehicles using real-time market data to help price your car or truck.'
                }
              </p>
            </div>
            {availableMakes.length > 0 && (
              <div className={`text-xs ${mode === 'buy' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
                Live Data: {availableMakes.length} makes • {availableModels.length} models • {availableYears.length} years
              </div>
            )}
          </div>
        </div>

        {(loadingAspects || refreshingAspects) && (
          <div className={`mb-6 p-4 ${mode === 'buy' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'} border rounded-lg`}>
            <div className="flex items-center">
              <Loader2 className={`h-5 w-5 animate-spin ${mode === 'buy' ? 'text-blue-600' : 'text-green-600'} mr-2`} />
              <span className={`${mode === 'buy' ? 'text-blue-800 dark:text-blue-200' : 'text-green-800 dark:text-green-200'}`}>
                {refreshingAspects ? 'Refreshing real-time vehicle data from eBay Browse API...' : 'Loading real-time vehicle options from eBay Browse API...'}
              </span>
            </div>
          </div>
        )}

        {/* No Data Available Notice */}
        {!loadingAspects && !refreshingAspects && availableMakes.length === 0 && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <RefreshCw className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" />
                <div>
                  <p className="text-yellow-800 dark:text-yellow-200 font-medium">Vehicle data unavailable</p>
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                    eBay's vehicle data is currently unavailable. You can still search manually or try refreshing.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRefreshAspects}
                className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-md transition-colors"
              >
                Retry
              </button>
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
                {availableMakes.map((make) => (
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
              {loadingModels && (
                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                  <Loader2 className="inline w-3 h-3 animate-spin mr-1" />
                  Loading...
                </span>
              )}
            </label>
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={loadingAspects || refreshingAspects || !selectedMake || loadingModels}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white appearance-none disabled:opacity-50"
              >
                <option value="">
                  {!selectedMake ? 'Select a make first' : loadingModels ? 'Loading models...' : 'Any Model'}
                </option>
                {availableModels.map((model) => (
                  <option key={`${model.value}-${model.make || 'generic'}`} value={model.value}>
                    {model.displayName} ({model.count.toLocaleString()})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
            {selectedMake && !loadingModels && availableModels.length === 0 && (
              <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                No specific models found for {selectedMake}. Try selecting a different make.
              </p>
            )}
            {selectedMake && !loadingModels && availableModels.length > 0 && (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                Showing {availableModels.length} models for {selectedMake} with real inventory counts
              </p>
            )}
          </div>

          {/* Year */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Year {selectedMake && selectedModel && `(${availableYears.length} available)`}
              {loadingYears && (
                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                  <Loader2 className="inline w-3 h-3 animate-spin mr-1" />
                  Loading...
                </span>
              )}
            </label>
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                disabled={loadingAspects || refreshingAspects || loadingYears || (!selectedMake && !selectedModel)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white appearance-none disabled:opacity-50"
              >
                <option value="">
                  {!selectedMake && !selectedModel ? 'Select make/model for specific years' : 
                   loadingYears ? 'Loading years...' : 'Any Year'}
                </option>
                {availableYears.map((year) => (
                  <option key={year.value} value={year.value}>
                    {year.displayName} ({year.count.toLocaleString()})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
            {selectedMake && selectedModel && !loadingYears && availableYears.length === 0 && (
              <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                No specific years found for {selectedMake} {selectedModel}. Try a different model.
              </p>
            )}
            {selectedMake && selectedModel && !loadingYears && availableYears.length > 0 && (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                Showing {availableYears.length} years for {selectedMake} {selectedModel} with real inventory counts
              </p>
            )}
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