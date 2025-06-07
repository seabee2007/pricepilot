import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SavedItem } from '../types';
import { getSavedItems, deleteSavedItem, updateSavedItem } from '../lib/supabase';
import SavedItemCard from '../components/SavedItemCard';
import { PlusCircle, Heart, Search } from 'lucide-react';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';

const SavedItemsPage = () => {
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSavedItems = async () => {
      setLoading(true);
      try {
        const items = await getSavedItems();
        setSavedItems(items);
      } catch (err) {
        console.error('Error fetching saved items:', err);
        setError('Failed to load saved items. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchSavedItems();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteSavedItem(id);
      setSavedItems(prevItems => prevItems.filter(item => item.id !== id));
      toast.success('Item removed from saved items');
    } catch (err) {
      console.error('Error deleting saved item:', err);
      toast.error('Failed to remove item. Please try again.');
    }
  };

  const handleUpdate = async (id: string, updates: { notes?: string; priceAlertThreshold?: number }) => {
    try {
      const updatedItem = await updateSavedItem(id, updates);
      setSavedItems(prevItems => 
        prevItems.map(item => item.id === id ? updatedItem : item)
      );
      toast.success('Item updated successfully');
    } catch (err) {
      console.error('Error updating saved item:', err);
      toast.error('Failed to update item. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Saved Items</h1>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 dark:border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Heart className="h-6 w-6 text-red-500 mr-2" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Saved Items</h1>
          <span className="ml-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full text-sm">
            {savedItems.length}
          </span>
        </div>
        <Link to="/">
          <Button
            variant="outline"
            icon={<Search className="h-4 w-4" />}
          >
            Find More Items
          </Button>
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded mb-6">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {savedItems.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow text-center p-8">
          <Heart className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">No saved items yet</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Start saving items you're interested in to track their prices and get alerts when they drop
          </p>
          <Link to="/">
            <Button variant="primary">
              Start Shopping
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedItems.map(savedItem => (
            <SavedItemCard
              key={savedItem.id}
              savedItem={savedItem}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedItemsPage;