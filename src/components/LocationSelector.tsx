import { useState } from 'react';
import { MapPin, Loader2, Check, AlertCircle } from 'lucide-react';
import { getUserLocation, LocationData, COUNTRY_OPTIONS, isValidPostalCode } from '../lib/location';
import Button from './ui/Button';
import toast from 'react-hot-toast';

interface LocationSelectorProps {
  onLocationChange: (location: LocationData) => void;
  initialLocation?: LocationData;
  disabled?: boolean;
}

const LocationSelector = ({ onLocationChange, initialLocation, disabled }: LocationSelectorProps) => {
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationMode, setLocationMode] = useState<'auto' | 'manual'>('manual');
  const [manualLocation, setManualLocation] = useState<LocationData>(
    initialLocation || {
      postalCode: '',
      city: '',
      state: '',
      countryCode: 'US',
    }
  );
  const [autoLocation, setAutoLocation] = useState<LocationData | null>(null);

  const handleGetCurrentLocation = async () => {
    setIsGettingLocation(true);
    
    try {
      const location = await getUserLocation();
      setAutoLocation(location);
      setLocationMode('auto');
      onLocationChange(location);
      toast.success(`Location found: ${location.city}, ${location.countryCode}`);
    } catch (error: any) {
      console.error('Location error:', error);
      toast.error(error.message || 'Failed to get your location');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleManualChange = (field: keyof LocationData, value: string) => {
    const updatedLocation = { ...manualLocation, [field]: value };
    setManualLocation(updatedLocation);
    
    // Validate postal code if both postal code and country are provided
    if (field === 'postalCode' || field === 'countryCode') {
      const postalCode = field === 'postalCode' ? value : updatedLocation.postalCode;
      const countryCode = field === 'countryCode' ? value : updatedLocation.countryCode;
      
      if (postalCode && countryCode && !isValidPostalCode(postalCode, countryCode)) {
        toast.error(`Invalid postal code format for ${countryCode}`);
        return;
      }
    }
    
    onLocationChange(updatedLocation);
  };

  const handleModeChange = (mode: 'auto' | 'manual') => {
    setLocationMode(mode);
    if (mode === 'auto' && autoLocation) {
      onLocationChange(autoLocation);
    } else if (mode === 'manual') {
      onLocationChange(manualLocation);
    }
  };

  const currentLocation = locationMode === 'auto' ? autoLocation : manualLocation;
  const isLocationValid = currentLocation?.postalCode && currentLocation?.countryCode;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Your Location
        </label>
        <div className="flex items-center space-x-2">
          {isLocationValid && (
            <Check className="h-4 w-4 text-green-500" />
          )}
          {currentLocation && !isLocationValid && (
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          )}
        </div>
      </div>

      {/* Location Mode Toggle */}
      <div className="flex rounded-md shadow-sm" role="group">
        <button
          type="button"
          disabled={disabled}
          className={`px-4 py-2 text-sm font-medium border rounded-l-md focus:z-10 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${
            locationMode === 'auto'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
          }`}
          onClick={() => handleModeChange('auto')}
        >
          <div className="flex items-center">
            <MapPin className="h-4 w-4 mr-2" />
            Auto
          </div>
        </button>
        <button
          type="button"
          disabled={disabled}
          className={`px-4 py-2 text-sm font-medium border rounded-r-md focus:z-10 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors ${
            locationMode === 'manual'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
          }`}
          onClick={() => handleModeChange('manual')}
        >
          Manual
        </button>
      </div>

      {/* Auto Location */}
      {locationMode === 'auto' && (
        <div className="space-y-3">
          {!autoLocation ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGetCurrentLocation}
              disabled={disabled || isGettingLocation}
              isLoading={isGettingLocation}
              icon={<MapPin className="h-4 w-4" />}
              className="w-full"
            >
              {isGettingLocation ? 'Getting Location...' : 'Use My Current Location'}
            </Button>
          ) : (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
              <div className="flex items-center">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                <div className="text-sm text-green-800 dark:text-green-200">
                  <div className="font-medium">
                    {autoLocation.city}, {autoLocation.state}
                  </div>
                  <div>
                    {autoLocation.postalCode} {autoLocation.country}
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={handleGetCurrentLocation}
                disabled={disabled || isGettingLocation}
                className="mt-2 p-0 h-auto text-green-600 dark:text-green-400"
              >
                Update Location
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Manual Location */}
      {locationMode === 'manual' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Country */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Country
            </label>
            <select
              value={manualLocation.countryCode || 'US'}
              onChange={(e) => handleManualChange('countryCode', e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>

          {/* Postal Code */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Postal Code
            </label>
            <input
              type="text"
              value={manualLocation.postalCode || ''}
              onChange={(e) => handleManualChange('postalCode', e.target.value)}
              disabled={disabled}
              placeholder="Enter postal code"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* City */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              City
            </label>
            <input
              type="text"
              value={manualLocation.city || ''}
              onChange={(e) => handleManualChange('city', e.target.value)}
              disabled={disabled}
              placeholder="Enter city"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* State */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              State/Province
            </label>
            <input
              type="text"
              value={manualLocation.state || ''}
              onChange={(e) => handleManualChange('state', e.target.value)}
              disabled={disabled}
              placeholder="Enter state/province"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      )}

      {/* Location Status */}
      {currentLocation && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {isLocationValid ? (
            <span className="text-green-600 dark:text-green-400">
              ✓ Location ready for eBay search
            </span>
          ) : (
            <span className="text-yellow-600 dark:text-yellow-400">
              ⚠ Postal code and country required for location-based search
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationSelector; 