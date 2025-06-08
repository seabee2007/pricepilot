import { useState, useEffect } from 'react';
import { SavedItem } from '../types';
import { getAllSavedItems, deleteSavedItem, triggerPriceAlertsManually, parseVehicleFromQuery } from '../lib/supabase';
import SavedItemCard from '../components/SavedSearchItem'; // Will be renamed to SavedItemCard
import AuthPrompt from '../components/AuthPrompt';
import { getCurrentUser } from '../lib/supabase';
import { Package, Bell, Loader2 } from 'lucide-react';
import Button from '../components/ui/Button';
import toast from 'react-hot-toast';
import { useVehicleValueMap, extractUniqueVehicleKeys, VehicleValue } from '../lib/useVehicleValueMap';

const SavedItemsPage = () => {
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [alertLoading, setAlertLoading] = useState(false);

  // 🔥 NEW: Extract unique vehicle keys and fetch values once for all saved items
  const uniqueVehicleKeys = savedItems
    .map(item => {
      const vehicleInfo = parseVehicleFromQuery(item.title || '');
      return vehicleInfo?.make && vehicleInfo?.model && vehicleInfo?.year 
        ? `${vehicleInfo.make}|${vehicleInfo.model}|${vehicleInfo.year}`
        : null;
    })
    .filter((key): key is string => key !== null)
    .filter((key, index, arr) => arr.indexOf(key) === index); // Remove duplicates

  const { valueMap: vehicleValueMap, loading: vehicleValuesLoading } = useVehicleValueMap(uniqueVehicleKeys);

  // Debug logging
  console.log('🚗 SavedItems - Unique vehicle keys:', uniqueVehicleKeys);
  console.log('🚗 SavedItems - Vehicle value map:', vehicleValueMap);

  const fetchSavedItems = async () => {
    try {
      setLoading(true);
      const items = await getAllSavedItems();
      // Filter to only show individual items
      const individualItems = items.filter(item => item.item_type === 'item');
      setSavedItems(individualItems);
    } catch (error) {
      console.error('Error fetching saved items:', error);
      toast.error('Failed to load saved items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      if (currentUser) {
        fetchSavedItems();
      } else {
        setLoading(false);
      }
    };

    checkUser();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteSavedItem(id);
      setSavedItems(prevItems => prevItems.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error deleting saved item:', error);
      toast.error('Failed to delete item');
    }
  };

  const handleUpdate = (id: string, updates: Partial<SavedItem>) => {
    setSavedItems(prevItems => 
      prevItems.map(item => 
        item.id === id ? { ...item, ...updates } : item
      )
    );
  };

  const handleTriggerAlerts = async () => {
    try {
      setAlertLoading(true);
      const result = await triggerPriceAlertsManually();
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error triggering price alerts:', error);
      toast.error('Failed to trigger price alerts');
    } finally {
      setAlertLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <AuthPrompt 
          title="Sign in to view your saved items"
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Saved Items
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Manage your saved eBay items. Set price alerts to get notified when prices drop.
        </p>

        {savedItems.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-6">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTriggerAlerts}
              disabled={alertLoading}
              className="flex items-center gap-2"
              icon={alertLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            >
              {alertLoading ? 'Checking...' : 'Check Price Alerts Now'}
            </Button>
          </div>
        )}
      </div>

      {savedItems.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <Package className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No saved items yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Search for items and click the save button to add them to your collection.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {savedItems.map(savedItem => {
            // 🚗 NEW: Get vehicle value data for this saved item
            const vehicleInfo = parseVehicleFromQuery(savedItem.title || '');
            const vehicleKey = vehicleInfo?.make && vehicleInfo?.model && vehicleInfo?.year 
              ? `${vehicleInfo.make}|${vehicleInfo.model}|${vehicleInfo.year}`
              : null;
            const vehicleValue = vehicleKey ? vehicleValueMap[vehicleKey] : null;

            return (
              <SavedItemCard
                key={savedItem.id}
                savedItem={savedItem}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                vehicleValue={vehicleValue}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SavedItemsPage;