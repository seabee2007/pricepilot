import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SavedSearch } from '../types';
import { getSavedSearches, deleteSavedSearch } from '../lib/supabase';
import SavedSearchItem from '../components/SavedSearchItem';
import { PlusCircle, Search } from 'lucide-react';
import Button from '../components/ui/Button';

const SavedSearchesPage = () => {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <Link to="/">
          <Button
            variant="outline"
            icon={<PlusCircle className="h-4 w-4" />}
          >
            New Search
          </Button>
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded mb-6">
          <p className="text-red-700 dark:text-red-400">{error}</p>
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