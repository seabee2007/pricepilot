# Vehicle Market Value Scraping Setup

This guide explains the new web scraping approach for vehicle market values that replaces the previous RapidAPI integration.

## What Changed

The vehicle market value feature now uses **web scraping** instead of RapidAPI to get more accurate and cost-effective market data.

### Previous Approach (RapidAPI)
- Single API value per vehicle
- Required paid RapidAPI subscription
- Limited data sources
- Higher cost per lookup

### New Approach (Web Scraping)
- Scrapes multiple sources: AutoTrader, Cars.com
- Provides Low/Average/High market values
- No recurring API costs
- More comprehensive market data
- 4-hour caching to prevent overloading sites

## Features

### Enhanced Market Data
- **Low Price**: Minimum price found across all sources
- **Average Price**: Calculated average of all found prices
- **High Price**: Maximum price found across all sources
- **Source Attribution**: Shows data comes from web scraping

### Smart Caching
- 4-hour cache per vehicle to avoid overwhelming target sites
- Cache stored in existing `vehicle_value_cache` table
- Automatic cache invalidation

### Backward Compatibility
- Existing components continue to work
- Automatic fallback to RapidAPI if scraping fails
- Legacy single-value format still supported

## How to Test

### 1. Using the Search Page
Navigate to `/search?q=2020 Audi A3` in your browser:
1. The system will detect it's a vehicle query
2. Click "Show Market Value" button
3. Fill in make/model/year and click "Get Market Value"
4. You'll see Low/Avg/High values from scraping

### 2. Using VehicleValueCard Directly
The `VehicleValueCard` component now supports both formats:
- New scraping format: Shows Low/Avg/High values
- Legacy API format: Shows single value (fallback)

### 3. Saved Items
Vehicle items in your saved list will automatically use the new scraping approach.

## Technical Implementation

### New Supabase Function
- **Function**: `scrape-vehicle-market-value`
- **Sources**: AutoTrader, Cars.com
- **Method**: DOM parsing with multiple selector fallbacks
- **Rate Limiting**: Gentle scraping with delays

### Updated Frontend
- **VehicleValueCard**: Enhanced UI for Low/Avg/High display
- **SavedSearchItem**: Shows price ranges for scraped data
- **Backward Compatibility**: Falls back to single value display

### Error Handling
- Graceful degradation if scraping fails
- Automatic fallback to RapidAPI
- User-friendly error messages
- Comprehensive logging

## Rate Limiting & Ethics

### Responsible Scraping
- 4-hour cache reduces requests
- Reasonable delays between requests
- Proper User-Agent headers
- Respects robots.txt intentions

### Monitoring
- All requests logged in Supabase
- Error tracking and alerting
- Performance monitoring

## Troubleshooting

### "No market data found" Error
- Try a different year or more common vehicle
- Check if make/model spelling is correct
- Some rare vehicles may not have enough market data

### Slow Response Times
- First request may take 2-3 seconds (live scraping)
- Subsequent requests are faster (cached)
- Multiple sources being scraped in parallel

### Fallback to RapidAPI
- If scraping fails, system automatically tries RapidAPI
- Check console logs for fallback messages
- Ensure RapidAPI credentials are still configured

## Cost Benefits

### Before (RapidAPI)
- $X per request
- Limited monthly quota
- Single data source

### After (Web Scraping)
- Only hosting/compute costs
- Unlimited requests (within reason)
- Multiple data sources
- Better price accuracy

## Future Enhancements

- Add more sources (Cargurus, CarMax, etc.)
- Implement price alerts for market changes
- Historical trend analysis
- Regional price variations
- Condition-based adjustments

## Migration Notes

- No database changes required
- Existing cache table reused
- RapidAPI credentials can remain for fallback
- Gradual rollout possible via feature flags 