export interface LocationData {
  postalCode?: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface GeolocationPosition {
  latitude: number;
  longitude: number;
}

// Get user's current position using browser geolocation
export async function getCurrentLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        let errorMessage = 'Failed to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  });
}

// Convert coordinates to address using a geocoding service
export async function reverseGeocode(lat: number, lng: number): Promise<LocationData> {
  try {
    // Using BigDataCloud's free reverse geocoding API (no API key required)
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    
    if (!response.ok) {
      throw new Error('Geocoding service unavailable');
    }
    
    const data = await response.json();
    
    return {
      postalCode: data.postcode || '',
      city: data.city || data.locality || '',
      state: data.principalSubdivision || '',
      country: data.countryName || '',
      countryCode: data.countryCode || '',
      latitude: lat,
      longitude: lng,
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    throw new Error('Failed to get address from coordinates');
  }
}

// Get user's location and convert to address
export async function getUserLocation(): Promise<LocationData> {
  try {
    const position = await getCurrentLocation();
    const locationData = await reverseGeocode(position.latitude, position.longitude);
    return locationData;
  } catch (error) {
    console.error('Get user location error:', error);
    throw error;
  }
}

// Format location for eBay API based on what data we have
export function formatLocationForEbay(location: LocationData): {
  postalCode?: string;
  countryCode?: string;
} {
  return {
    postalCode: location.postalCode,
    countryCode: location.countryCode,
  };
}

// Get country options for manual selection
export const COUNTRY_OPTIONS = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'JP', name: 'Japan' },
  { code: 'IN', name: 'India' },
];

// Validate postal code format by country
export function isValidPostalCode(postalCode: string, countryCode: string): boolean {
  if (!postalCode) return false;
  
  const patterns = {
    US: /^\d{5}(-\d{4})?$/, // 12345 or 12345-6789
    CA: /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/, // A1A 1A1 or A1A1A1
    GB: /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/, // SW1A 1AA
    AU: /^\d{4}$/, // 1234
    DE: /^\d{5}$/, // 12345
    FR: /^\d{5}$/, // 12345
    IT: /^\d{5}$/, // 12345
    ES: /^\d{5}$/, // 12345
    JP: /^\d{3}-\d{4}$/, // 123-4567
    IN: /^\d{6}$/, // 123456
  };
  
  const pattern = patterns[countryCode as keyof typeof patterns];
  return pattern ? pattern.test(postalCode) : true; // Default to valid for unknown countries
} 