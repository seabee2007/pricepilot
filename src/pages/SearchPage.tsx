import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Car } from 'lucide-react';
import { parseVehicleFromQuery } from '../lib/supabase';
import Button from '../components/ui/Button';
import VehicleValueCard from '../components/VehicleValueCard';
import toast from 'react-hot-toast';

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  
  const [searchInput, setSearchInput] = useState(query);
  const [showVehicleCard, setShowVehicleCard] = useState(false);
  
  // Parse vehicle info from the query
  const vehicleInfo = parseVehicleFromQuery(query);
  const isVehicleQuery = vehicleInfo !== null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) {
      toast.error('Please enter a search query');
      return;
    }
    
    // Navigate to results page
    navigate(`/results?q=${encodeURIComponent(searchInput.trim())}&mode=buy`);
  };

  const goBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Button
              variant="outline"
              onClick={goBack}
              className="mr-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Search Results
            </h1>
          </div>
        </div>

        {/* Search Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search for items, vehicles, parts..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
            <Button type="submit">
              Search
            </Button>
          </form>
          
          {/* Vehicle Detection Info */}
          {isVehicleQuery && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Car className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
                  <span className="text-blue-800 dark:text-blue-200 text-sm">
                    Vehicle detected: {vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVehicleCard(!showVehicleCard)}
                >
                  {showVehicleCard ? 'Hide' : 'Show'} Market Value
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Vehicle Value Card */}
        {showVehicleCard && isVehicleQuery && (
          <div className="mb-8">
            <VehicleValueCard
              initialRequest={{
                make: vehicleInfo.make,
                model: vehicleInfo.model,
                year: vehicleInfo.year
              }}
              onValueUpdate={(value) => {
                console.log('Vehicle value updated:', value);
                toast.success(`Market value retrieved: ${value.source === 'web_scraping' ? 'via scraping' : 'via API'}`);
              }}
            />
          </div>
        )}

        {/* Search Results would go here */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Search Test Page
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This page is for testing the new vehicle market value scraping functionality.
              {query && ` Current query: "${query}"`}
            </p>
            
            {isVehicleQuery ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 max-w-md mx-auto">
                <p className="text-green-800 dark:text-green-200 text-sm">
                  ✅ Vehicle query detected! Click "Show Market Value" above to test the scraping functionality.
                </p>
              </div>
            ) : (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 max-w-md mx-auto">
                <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                  Try searching for a vehicle like "2020 Audi A3" or "Ford F-150 2018" to test the market value scraping.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchPage; 