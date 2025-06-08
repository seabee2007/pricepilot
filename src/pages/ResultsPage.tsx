import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SearchMode, SearchFilters, PriceHistory, ItemSummary } from '../types';
import { savePriceHistory, getPriceHistory } from '../lib/supabase';
import { searchLiveItems, searchCompletedItems, calculateAveragePrice } from '../lib/ebay';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import ResultsList from '../components/ResultsList';
import PriceHistoryChart from '../components/PriceHistoryChart';
import AuthPrompt from '../components/AuthPrompt';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';
import { config } from '../lib/config';

const ResultsPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const mode = searchParams.get('mode') as SearchMode || 'buy';
  const query = searchParams.get('q') || '';
  const filtersParam = searchParams.get('filters') || '{}';
  
  // Memoize the filters object to prevent unnecessary re-renders
  const filters: SearchFilters = useMemo(() => {
    try {
      return JSON.parse(decodeURIComponent(filtersParam));
    } catch (error) {
      console.error('Error parsing filters from URL:', error);
      return {};
    }
  }, [filtersParam]);
  
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lowestPrice, setLowestPrice] = useState(0);
  const [isAuthError, setIsAuthError] = useState(false);

  useEffect(() => {
    console.log('🚀 useEffect triggered');
    console.log('🚀 Query:', query);
    console.log('🚀 Mode:', mode);
    console.log('🚀 Current loading state:', loading);
    
    const fetchData = async () => {
      console.log('📞 fetchData called');
      
      if (!query) {
        console.log('❌ No query, navigating home');
        navigate('/');
        return;
      }
      
      // Prevent multiple simultaneous requests
      if (loading) {
        console.log('⏸️ Already loading, skipping request');
        if (config.debug.showConsoleMessages) {
          console.log('Skipping request - already loading');
        }
        return;
      }
      
      console.log('✅ Starting API call process');
      
      if (config.debug.showConsoleMessages) {
        console.log(`[Testing] Starting search: "${query}" in ${mode} mode`);
      }
      setLoading(true);
      setError(null);
      setIsAuthError(false);
      
      try {
        let results: ItemSummary[] = [];
        
        if (mode === 'buy') {
          if (config.debug.showConsoleMessages) {
            console.log('[Testing] Searching live items...');
          }
          results = await searchLiveItems(query, filters);
        } else {
          if (config.debug.showConsoleMessages) {
            console.log('[Testing] Searching completed items...');
          }
          results = await searchCompletedItems(query, filters);
          
          // For sell mode, also fetch enhanced price history
          try {
            const enhancedHistory = await getPriceHistory(undefined, query);
            if (enhancedHistory && enhancedHistory.length > 0) {
              // Convert to legacy format for compatibility
              const legacyHistory = enhancedHistory.map(point => ({
                id: `${query}-${point.day}`,
                query,
                timestamp: point.day,
                avg_price: point.avg_price
              }));
              setPriceHistory(legacyHistory);
            } else {
              // Fallback to legacy price history
              const history = await getPriceHistory(undefined, query);
              setPriceHistory(history);
            }
          } catch (historyError) {
            console.error('Error fetching enhanced price history, falling back to legacy:', historyError);
            const history = await getPriceHistory(undefined, query);
            setPriceHistory(history);
          }
          
          // Calculate and save average price with enhanced data
          if (results.length > 0) {
            const avgPrice = calculateAveragePrice(results);
            const prices = results
              .filter(item => item.price && typeof item.price.value === 'number')
              .map(item => item.price.value);
            
            const minPrice = prices.length > 0 ? Math.min(...prices) : avgPrice;
            const maxPrice = prices.length > 0 ? Math.max(...prices) : avgPrice;
            
            if (avgPrice > 0) {
              await savePriceHistory(query, avgPrice, undefined, minPrice, maxPrice);
              
              // Refresh price history after adding new point
              try {
                const updatedHistory = await getPriceHistory(undefined, query);
                if (updatedHistory && updatedHistory.length > 0) {
                  const legacyHistory = updatedHistory.map(point => ({
                    id: `${query}-${point.day}`,
                    query,
                    timestamp: point.day,
                    avg_price: point.avg_price
                  }));
                  setPriceHistory(legacyHistory);
                }
              } catch (refreshError) {
                console.error('Error refreshing price history:', refreshError);
              }
            }
          }
        }
        
        // 🕵️‍♂️ Debug the API response
        console.group('🕵️‍♂️ eBay API response analysis');
        console.log('Raw results from API:', results);
        console.log('Results length:', results?.length || 0);
        console.log('Results type:', typeof results);
        console.log('Is array?', Array.isArray(results));
        if (results && results.length > 0) {
          console.log('First item structure:', results[0]);
          console.log('First item has price?', !!results[0]?.price);
          console.log('First item price value:', results[0]?.price?.value);
          console.log('First item title:', results[0]?.title);
        }
        console.groupEnd();
        
        if (config.debug.showConsoleMessages) {
          console.log(`[Testing] Search completed. Found ${results.length} items.`);
        }
        setItems(results);
        
        // Find lowest price for buy mode
        if (mode === 'buy' && results.length > 0) {
          const validPrices = results
            .filter(item => item.price && typeof item.price.value === 'number')
            .map(item => item.price.value);
          
          if (validPrices.length > 0) {
            setLowestPrice(Math.min(...validPrices));
          }
        }
      } catch (err) {
        if (config.debug.showConsoleMessages) {
          console.error('[Testing] Error fetching data:', err);
        }
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data from eBay. Please try again.';
        
        // Check if it's an authentication error
        if (errorMessage.includes('Authentication required') || 
            errorMessage.includes('Authentication failed') ||
            errorMessage.includes('Please sign in')) {
          setIsAuthError(true);
          setError(errorMessage);
        } else if (errorMessage.includes('eBay API credentials are missing') || errorMessage.includes('authentication failed')) {
          setError(`${errorMessage} Please check the setup instructions in EBAY_API_SETUP.md for configuring your eBay API credentials.`);
        } else if (errorMessage.includes('ERR_INSUFFICIENT_RESOURCES')) {
          setError('Too many requests. Please wait a moment and try again.');
        } else if (errorMessage.includes('Rate limit exceeded')) {
          setError(`${errorMessage}${config.rateLimit.isTestingMode ? ' This is normal during testing - we have strict rate limiting enabled.' : ''}`);
        } else if (errorMessage.includes('Too many concurrent requests')) {
          setError('Too many requests at once. Please wait and try again.');
        } else {
          setError(errorMessage);
        }
        
        if (!isAuthError) {
          toast.error('Error fetching results. Check console for details.');
        }
      } finally {
        setLoading(false);
        if (config.debug.showConsoleMessages) {
          console.log('[Testing] Request completed.');
        }
      }
    };
    
    // Add a longer delay during testing to prevent rapid successive calls
    if (config.debug.showConsoleMessages) {
      console.log(`[Testing] Scheduling search for: "${query}"`);
    }
    
    console.log('⏰ Setting timeout with delay:', config.rateLimit.requestTimeout);
    console.log('⏰ Will call fetchData in', config.rateLimit.requestTimeout, 'ms');
    
    const timeoutId = setTimeout(() => {
      console.log('⏰ Timeout fired, calling fetchData');
      fetchData();
    }, config.rateLimit.requestTimeout);
    
    return () => {
      console.log('🧹 Cleaning up timeout');
      if (config.debug.showConsoleMessages) {
        console.log('[Testing] Cleaning up timeout');
      }
      clearTimeout(timeoutId);
    };
  }, [query, mode, filters, navigate]); // filters is now properly memoized

  const goBack = () => {
    // Check if this is a vehicle/motors search and navigate accordingly
    const isVehicleSearch = filters.category === 'motors' || 
                           filters.vehicleAspects ||
                           query.toLowerCase().match(/\b(car|truck|vehicle|auto|ford|chevrolet|dodge|toyota|honda|nissan|bmw|mercedes|audi|volkswagen|jeep|ram|gmc|cadillac|buick|lincoln|acura|lexus|infiniti|mazda|subaru|mitsubishi|hyundai|kia|volvo|porsche|ferrari|lamborghini|maserati|bentley|rolls|jaguar|land rover|mini|fiat|alfa romeo|chrysler|tesla|mustang|camaro|corvette|challenger|charger|viper|wrangler|silverado|f-150|tacoma|tundra|accord|civic|camry|prius|altima|sentra|pathfinder|pilot|cr-v|rav4|highlander|4runner|escalade|tahoe|suburban|yukon|explorer|escape|focus|fusion|edge|bronco)\b/);
    
    if (isVehicleSearch) {
      // Navigate to home page with motors category pre-selected to show VehicleSearchForm
      navigate('/?category=motors');
    } else {
      // Navigate to regular home page
      navigate('/');
    }
  };

  // Determine if this is a vehicle search for UI purposes
  const isVehicleSearch = filters.category === 'motors' || 
                         filters.vehicleAspects ||
                         query.toLowerCase().match(/\b(car|truck|vehicle|auto|ford|chevrolet|dodge|toyota|honda|nissan|bmw|mercedes|audi|volkswagen|jeep|ram|gmc|cadillac|buick|lincoln|acura|lexus|infiniti|mazda|subaru|mitsubishi|hyundai|kia|volvo|porsche|ferrari|lamborghini|maserati|bentley|rolls|jaguar|land rover|mini|fiat|alfa romeo|chrysler|tesla|mustang|camaro|corvette|challenger|charger|viper|wrangler|silverado|f-150|tacoma|tundra|accord|civic|camry|prius|altima|sentra|pathfinder|pilot|cr-v|rav4|highlander|4runner|escalade|tahoe|suburban|yukon|explorer|escape|focus|fusion|edge|bronco)\b/);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Testing Mode Banner */}
      {config.debug.showTestingBanner && (
        <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Testing Mode Active
              </h3>
              <div className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                <p>Rate limiting is set to {config.rateLimit.minRequestInterval / 1000} seconds between identical requests and max {config.rateLimit.maxConcurrentRequests} concurrent requests. Check browser console for detailed logs.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={goBack}
          className="mb-4"
          icon={<ArrowLeft className="h-4 w-4" />}
        >
          {isVehicleSearch ? 'Back to Vehicle Search' : 'Back to Search'}
        </Button>
        
        <h1 className={`text-2xl font-bold ${mode === 'buy' ? 'text-blue-700 dark:text-blue-500' : 'text-green-700 dark:text-green-500'}`}>
          {mode === 'buy' ? 'Buy Results' : 'Sell Estimate'}: {query}
        </h1>
      </div>
      
      {error ? (
        isAuthError ? (
          <AuthPrompt 
            query={query}
            mode={mode}
            title="Sign in to search eBay"
            description="Create a free account or sign in to search for the best deals and price estimates on eBay."
          />
        ) : (
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded mb-6">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="text-red-800 dark:text-red-400 font-medium mb-2">API Configuration Error</h3>
                <p className="text-red-700 dark:text-red-400 text-sm leading-relaxed">{error}</p>
                {error.includes('credentials') && (
                  <div className="mt-3 text-sm text-red-600 dark:text-red-400">
                    <p className="font-medium">To fix this issue:</p>
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>Create a <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">.env</code> file in your project root</li>
                      <li>Add your eBay API credentials:
                        <pre className="bg-red-100 dark:bg-red-900/30 p-2 rounded mt-1 text-xs">
{`VITE_EBAY_CLIENT_ID=your_ebay_client_id_here
VITE_EBAY_CLIENT_SECRET=your_ebay_client_secret_here`}
                        </pre>
                      </li>
                      <li>Restart your development server</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      ) : (
        <>
          <ResultsList 
            items={items} 
            mode={mode} 
            isLoading={loading}
          />
          
          {mode === 'sell' && !loading && (
            <PriceHistoryChart 
              data={priceHistory} 
              query={query} 
              showSparkline={false}
              className="mb-8"
            />
          )}
        </>
      )}
    </div>
  );
};

export default ResultsPage;