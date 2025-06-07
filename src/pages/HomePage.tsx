import { useState } from 'react';
import { DollarSign, ShoppingCart, Car } from 'lucide-react';
import SearchForm from '../components/SearchForm';
import VehicleSearchForm from '../components/VehicleSearchForm';
import { SearchMode } from '../types';

const HomePage = () => {
  const [activeMode, setActiveMode] = useState<SearchMode>('buy');
  const [searchType, setSearchType] = useState<'general' | 'vehicle'>('general');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
          <span className="block text-gray-900 dark:text-white">Fly Through</span>
          <span className="block text-blue-600 dark:text-blue-500">eBay's Best Offers</span>
        </h1>
        <p className="mt-3 max-w-md mx-auto text-base text-gray-500 dark:text-gray-400 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
          Find the best deals when buying or set the perfect price when selling. 
          PricePilot analyzes eBay listings to give you real-time market insights.
        </p>
      </div>

      {/* Search Type Toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-md shadow-sm" role="group">
          <button
            type="button"
            className={`py-3 px-6 text-sm font-medium rounded-l-lg focus:z-10 focus:ring-2 focus:outline-none transition-colors
              ${searchType === 'general' 
                ? 'bg-gray-700 text-white dark:bg-gray-600' 
                : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
            onClick={() => setSearchType('general')}
          >
            <div className="flex items-center">
              <ShoppingCart className="mr-2 h-4 w-4" />
              General Search
            </div>
          </button>
          <button
            type="button"
            className={`py-3 px-6 text-sm font-medium rounded-r-lg focus:z-10 focus:ring-2 focus:outline-none transition-colors
              ${searchType === 'vehicle' 
                ? 'bg-gray-700 text-white dark:bg-gray-600' 
                : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
            onClick={() => setSearchType('vehicle')}
          >
            <div className="flex items-center">
              <Car className="mr-2 h-4 w-4" />
              Vehicle Search
            </div>
          </button>
        </div>
      </div>

      {/* Mode Tabs (only for general search) */}
      {searchType === 'general' && (
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-md shadow-sm" role="group">
            <button
              type="button"
              className={`py-3 px-6 text-sm font-medium rounded-l-lg focus:z-10 focus:ring-2 focus:outline-none transition-colors
                ${activeMode === 'buy' 
                  ? 'bg-blue-700 text-white dark:bg-blue-600' 
                  : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
              onClick={() => setActiveMode('buy')}
            >
              <div className="flex items-center">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Buy Mode
              </div>
            </button>
            <button
              type="button"
              className={`py-3 px-6 text-sm font-medium rounded-r-lg focus:z-10 focus:ring-2 focus:outline-none transition-colors
                ${activeMode === 'sell' 
                  ? 'bg-green-700 text-white dark:bg-green-600' 
                  : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
              onClick={() => setActiveMode('sell')}
            >
              <div className="flex items-center">
                <DollarSign className="mr-2 h-4 w-4" />
                Sell Mode
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Mode Description */}
      {searchType === 'general' && (
        <div className="max-w-2xl mx-auto mb-8">
          <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-8 border-l-4 ${activeMode === 'buy' ? 'border-blue-500' : 'border-green-500'}`}>
            {activeMode === 'buy' ? (
              <p className="text-gray-700 dark:text-gray-300">
                <strong>Buy Mode:</strong> Find the lowest-priced items matching your keywords. 
                Results are sorted by price (lowest first) to help you snag the best deal.
              </p>
            ) : (
              <p className="text-gray-700 dark:text-gray-300">
                <strong>Sell Mode:</strong> See what similar items have sold for recently.
                Results are sorted by price (highest first) to help you price your item competitively.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Vehicle Search Description */}
      {searchType === 'vehicle' && (
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-8 border-l-4 border-blue-500">
            <p className="text-gray-700 dark:text-gray-300">
              <strong>Vehicle Search:</strong> Search for cars and trucks using specific make, model, and year criteria. 
              Get accurate results from eBay's Cars & Trucks category with advanced filtering options.
            </p>
          </div>
        </div>
      )}

      {/* Search Form */}
      <div className="max-w-4xl mx-auto">
        {searchType === 'general' ? (
          <>
            <div className={`rounded-t-lg ${activeMode === 'buy' ? 'bg-blue-800 dark:bg-blue-700' : 'bg-green-800 dark:bg-green-700'} p-4 text-white text-center`}>
              <h2 className="text-xl font-semibold">
                {activeMode === 'buy' ? 'Find the Best Price to Buy' : 'See What Your Item is Worth'}
              </h2>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-b-lg shadow-md p-6">
              <SearchForm mode={activeMode} />
            </div>
          </>
        ) : (
          <VehicleSearchForm />
        )}
      </div>

      {/* Features */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-8">
          How PricePilot Helps You
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border-t-4 border-blue-500">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Find the Best Deals</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Our smart search filters through thousands of listings to find you the lowest prices, with options to filter by condition, shipping, and more.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border-t-4 border-green-500">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Price Your Items Right</h3>
            <p className="text-gray-600 dark:text-gray-400">
              See what similar items have sold for recently, with detailed price history to help you set the perfect asking price.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border-t-4 border-purple-500">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Vehicle-Specific Search</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Search for cars and trucks with precise make, model, and year filters. Get real vehicle listings, not toys or parts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;