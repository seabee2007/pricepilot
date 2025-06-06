import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ResultsList from '../components/ResultsList';
import PriceHistoryChart from '../components/PriceHistoryChart';
import SaveThresholdModal from '../components/SaveThresholdModal';
import { ItemSummary, SearchFilters, SearchMode, PriceHistory } from '../types';
import { searchLiveItems, searchCompletedItems, calculateAveragePrice } from '../lib/ebay';
import { savePriceHistory, saveSearch, getPriceHistory } from '../lib/supabase';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';

const ResultsPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const mode = searchParams.get('mode') as SearchMode || 'buy';
  const query = searchParams.get('q') || '';
  const filtersParam = searchParams.get('filters') || '{}';
  const filters: SearchFilters = JSON.parse(decodeURIComponent(filtersParam));
  
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [lowestPrice, setLowestPrice] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!query) {
        navigate('/');
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        let results: ItemSummary[] = [];
        
        if (mode === 'buy') {
          results = await searchLiveItems(query, filters);
        } else {
          results = await searchCompletedItems(query, filters);
          
          // For sell mode, also fetch price history
          const history = await getPriceHistory(query);
          setPriceHistory(history);
          
          // Calculate and save average price
          if (results.length > 0) {
            const avgPrice = calculateAveragePrice(results);
            if (avgPrice > 0) {
              await savePriceHistory(query, avgPrice);
              
              // Refresh price history after adding new point
              const updatedHistory = await getPriceHistory(query);
              setPriceHistory(updatedHistory);
            }
          }
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
        console.error('Error fetching data:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data from eBay. Please try again.';
        
        // Check if it's an API credentials error
        if (errorMessage.includes('eBay API credentials are missing') || errorMessage.includes('authentication failed')) {
          setError(`${errorMessage} Please check the setup instructions in EBAY_API_SETUP.md for configuring your eBay API credentials.`);
        } else {
          setError(errorMessage);
        }
        
        toast.error('Error fetching results. Please check your API configuration.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [query, mode, filters, navigate]);

  const handleSaveSearch = () => {
    setShowSaveModal(true);
  };

  const handleSaveWithThreshold = async (threshold: number) => {
    try {
      await saveSearch(query, filters, threshold);
      setShowSaveModal(false);
      toast.success('Search saved! You will be notified when prices drop below your threshold.');
    } catch (err) {
      console.error('Error saving search:', err);
      toast.error('Failed to save search. Please try again.');
    }
  };

  const goBack = () => {
    navigate('/');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={goBack}
          className="mb-4"
          icon={<ArrowLeft className="h-4 w-4" />}
        >
          Back to Search
        </Button>
        
        <h1 className={`text-2xl font-bold ${mode === 'buy' ? 'text-blue-700 dark:text-blue-500' : 'text-green-700 dark:text-green-500'}`}>
          {mode === 'buy' ? 'Buy Results' : 'Sell Estimate'}: {query}
        </h1>
      </div>
      
      {error ? (
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
      ) : (
        <>
          <ResultsList 
            items={items} 
            mode={mode} 
            onSaveSearch={handleSaveSearch}
            isLoading={loading}
          />
          
          {mode === 'sell' && !loading && (
            <PriceHistoryChart data={priceHistory} query={query} />
          )}
        </>
      )}
      
      {showSaveModal && (
        <SaveThresholdModal 
          isOpen={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          onSave={handleSaveWithThreshold}
          currentLowestPrice={lowestPrice}
        />
      )}
    </div>
  );
};

export default ResultsPage;