import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SavedSearch } from '../types';
import { getSavedSearches, deleteSavedSearch, triggerPriceAlertsManually, sendTestEmail } from '../lib/supabase';
import SavedSearchItem from '../components/SavedSearchItem';
import { PlusCircle, Search, Bell, TestTube2, Mail } from 'lucide-react';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';

const SavedSearchesPage = () => {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingAlerts, setTestingAlerts] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  useEffect(() => {
    const fetchSavedSearches = async () => {
      setLoading(true);
      try {
        const searches = await getSavedSearches();
        setSavedSearches(searches);
      } catch (err) {
        console.error('Error fetching saved searches:', err);
        setError('Failed to load saved searches. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchSavedSearches();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteSavedSearch(id);
      setSavedSearches(prevSearches => prevSearches.filter(search => search.id !== id));
    } catch (err) {
      console.error('Error deleting saved search:', err);
      setError('Failed to delete saved search. Please try again.');
    }
  };

  const handleTestPriceAlerts = async () => {
    if (savedSearches.length === 0) {
      toast.error('No saved searches to test. Please save a search first.');
      return;
    }

    setTestingAlerts(true);
    console.log('🧪 Starting manual price alert test...');
    
    try {
      const result = await triggerPriceAlertsManually();
      console.log('🧪 Test result:', result);
      
      if (result.success) {
        toast.success(`✅ ${result.message}`);
        console.log('✅ Price alerts test successful');
      } else {
        toast.error(`❌ ${result.message}`);
        console.error('❌ Price alerts test failed:', result.message);
      }
    } catch (err) {
      console.error('💥 Error testing price alerts:', err);
      
      // Show the specific error message if available
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast.error(`Failed to test price alerts: ${errorMessage}`);
    } finally {
      setTestingAlerts(false);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingTestEmail(true);
    console.log('📧 Sending test email...');
    
    try {
      const result = await sendTestEmail();
      console.log('📧 Test email result:', result);
      
      if (result.success) {
        toast.success(`✅ ${result.message}`);
        console.log('✅ Test email sent successfully');
      } else {
        toast.error(`❌ ${result.message}`);
        console.error('❌ Test email failed:', result.message);
      }
    } catch (err) {
      console.error('💥 Error sending test email:', err);
      
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast.error(`Failed to send test email: ${errorMessage}`);
    } finally {
      setSendingTestEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Saved Searches</h1>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 dark:border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Saved Searches</h1>
        <div className="flex gap-3">
          {savedSearches.length > 0 && (
            <Button
              variant="outline"
              onClick={handleTestPriceAlerts}
              disabled={testingAlerts}
              icon={<TestTube2 className="h-4 w-4" />}
            >
              {testingAlerts ? 'Testing...' : 'Test Price Alerts'}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleSendTestEmail}
            disabled={sendingTestEmail}
            icon={<Mail className="h-4 w-4" />}
          >
            {sendingTestEmail ? 'Sending...' : 'Send Test Email'}
          </Button>
          <Link to="/">
            <Button
              variant="outline"
              icon={<PlusCircle className="h-4 w-4" />}
            >
              New Search
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded mb-6">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {savedSearches.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                Price Alerts Active
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                We'll monitor eBay prices and email you when items drop below your threshold.
                Use the "Test Price Alerts" button to manually check all your saved searches.
              </p>
              
              {/* Debug Info */}
              <details className="mt-3">
                <summary className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                  🔧 Debug Info (click to expand)
                </summary>
                <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-mono">
                  <div>Supabase URL: {import.meta.env.VITE_SUPABASE_URL ? '✅ Connected' : '❌ Missing'}</div>
                  <div>API Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Configured' : '❌ Missing'}</div>
                  <div>Edge Function: {import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-price-alerts</div>
                </div>
              </details>
            </div>
          </div>
        </div>
      )}

      {savedSearches.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow text-center p-8">
          <Search className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">No saved searches yet</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Save your searches to get notified when prices drop below your threshold
          </p>
          <Link to="/">
            <Button variant="primary">
              Start Searching
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {savedSearches.map(savedSearch => (
            <SavedSearchItem
              key={savedSearch.id}
              savedSearch={savedSearch}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedSearchesPage;