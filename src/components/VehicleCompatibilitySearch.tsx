import React, { useState } from 'react';
import { VehicleCompatibility, ItemSummary } from '../types';
import { searchCompatibleItems, checkItemCompatibility, validateVehicleCompatibility, getAutomotiveCategories } from '../lib/ebay';

interface VehicleCompatibilitySearchProps {
  onResults?: (items: ItemSummary[]) => void;
}

export const VehicleCompatibilitySearch: React.FC<VehicleCompatibilitySearchProps> = ({ onResults }) => {
  const [query, setQuery] = useState('');
  const [vehicle, setVehicle] = useState<VehicleCompatibility>({
    vehicleType: 'car'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ItemSummary[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');

  const categories = getAutomotiveCategories();

  const handleSearch = async () => {
    setError(null);
    
    // Validate vehicle data
    const validationErrors = validateVehicleCompatibility(vehicle);
    if (validationErrors.length > 0) {
      setError(`Please fill in required fields: ${validationErrors.join(', ')}`);
      return;
    }

    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setLoading(true);
    try {
      const filters = selectedCategory ? { category: selectedCategory } : {};
      const items = await searchCompatibleItems(query, vehicle, filters);
      setResults(items);
      onResults?.(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckCompatibility = async (itemId: string) => {
    try {
      const compatibility = await checkItemCompatibility(itemId, vehicle);
      alert(`Compatibility Status: ${compatibility.compatibilityStatus || 'Unknown'}\nMatch Level: ${compatibility.compatibilityMatch || 'Unknown'}`);
    } catch (err) {
      alert(`Error checking compatibility: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Vehicle Compatibility Search</h2>
      
      {/* Vehicle Information */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Vehicle Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
            <select
              value={vehicle.vehicleType || 'car'}
              onChange={(e) => setVehicle({ ...vehicle, vehicleType: e.target.value as 'car' | 'truck' | 'motorcycle' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="car">Car</option>
              <option value="truck">Truck</option>
              <option value="motorcycle">Motorcycle</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year *</label>
            <input
              type="text"
              value={vehicle.year || ''}
              onChange={(e) => setVehicle({ ...vehicle, year: e.target.value })}
              placeholder="e.g., 2018"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Make *</label>
            <input
              type="text"
              value={vehicle.make || ''}
              onChange={(e) => setVehicle({ ...vehicle, make: e.target.value })}
              placeholder="e.g., Honda"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
            <input
              type="text"
              value={vehicle.model || ''}
              onChange={(e) => setVehicle({ ...vehicle, model: e.target.value })}
              placeholder="e.g., Civic"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {vehicle.vehicleType === 'motorcycle' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Submodel *</label>
              <input
                type="text"
                value={vehicle.submodel || ''}
                onChange={(e) => setVehicle({ ...vehicle, submodel: e.target.value })}
                placeholder="e.g., Sport"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trim *</label>
                <input
                  type="text"
                  value={vehicle.trim || ''}
                  onChange={(e) => setVehicle({ ...vehicle, trim: e.target.value })}
                  placeholder="e.g., EX Sedan 4-Door"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Engine *</label>
                <input
                  type="text"
                  value={vehicle.engine || ''}
                  onChange={(e) => setVehicle({ ...vehicle, engine: e.target.value })}
                  placeholder="e.g., 1.8L 1799CC l4 GAS SOHC"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Search Parameters */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Search Parameters</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Query *</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., brake pads, air filter, headlight"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category (Optional)</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Search Button */}
      <div className="mb-6">
        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Searching...' : 'Search Compatible Items'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-700">
            Compatible Items ({results.length} found)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((item) => (
              <div key={item.itemId} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                {item.image && (
                  <img
                    src={item.image.imageUrl}
                    alt={item.title}
                    className="w-full h-48 object-cover rounded-md mb-3"
                  />
                )}
                
                <h4 className="font-semibold text-sm mb-2 line-clamp-2">{item.title}</h4>
                
                <div className="flex justify-between items-center mb-2">
                  <span className="text-lg font-bold text-green-600">
                    ${item.price.value.toFixed(2)}
                  </span>
                  {item.condition && (
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {item.condition}
                    </span>
                  )}
                </div>

                {item.compatibility && (
                  <div className="mb-2 p-2 bg-green-50 rounded text-xs">
                    <div className="font-semibold text-green-700">
                      Compatibility: {item.compatibility.compatibilityMatch || 'Unknown'}
                    </div>
                    {item.compatibility.compatibilityProperties && item.compatibility.compatibilityProperties.length > 0 && (
                      <div className="text-green-600 mt-1">
                        {item.compatibility.compatibilityProperties.map(prop => 
                          `${prop.name}: ${prop.value}`
                        ).join(', ')}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <a
                    href={item.itemWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                  >
                    View on eBay
                  </a>
                  
                  <button
                    onClick={() => handleCheckCompatibility(item.itemId)}
                    className="px-3 py-2 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                  >
                    Check Compatibility
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 