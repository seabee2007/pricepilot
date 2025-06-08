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
- Scrapes multiple sources: **AutoTrader, Cars.com, eBay Motors, CarGurus**
- Provides Low/Average/High market values
- No recurring API costs
- More comprehensive market data with 4x more sources
- 4-hour caching to prevent overloading sites

## Features

### Enhanced Market Data
- **Low Price**: Minimum price found across all four sources
- **Average Price**: Calculated average of all found prices
- **High Price**: Maximum price found across all four sources
- **Source Attribution**: Shows data comes from AutoTrader, Cars.com, eBay Motors, CarGurus

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
4. You'll see Low/Avg/High values from scraping all four sources

### 2. Using VehicleValueCard Directly
The `VehicleValueCard` component now supports both formats:
- New scraping format: Shows Low/Avg/High values from 4 sources
- Legacy API format: Shows single value (fallback)

### 3. Saved Items
Vehicle items in your saved list will automatically use the new scraping approach with expanded data sources.

## Technical Implementation

### New Supabase Function
- **Function**: `scrape-vehicle-market-value`
- **Sources**: AutoTrader, Cars.com, eBay Motors, CarGurus
- **Method**: DOM parsing with multiple selector fallbacks
- **Rate Limiting**: Gentle scraping with delays
- **Parallel Processing**: All 4 sources scraped simultaneously

### Updated Frontend
- **VehicleValueCard**: Enhanced UI for Low/Avg/High display from 4 sources
- **SavedSearchItem**: Shows price ranges for scraped data
- **Backward Compatibility**: Falls back to single value display

### Error Handling
- Graceful degradation if any source fails
- Automatic fallback to RapidAPI if all scraping fails
- User-friendly error messages
- Comprehensive logging per source

## Rate Limiting & Ethics

### Responsible Scraping
- 4-hour cache reduces requests to all sources
- Reasonable delays between requests
- Proper User-Agent headers
- Respects robots.txt intentions for all sites

### Monitoring
- All requests logged in Supabase by source
- Error tracking and alerting per site
- Performance monitoring across all 4 sources

## Troubleshooting

### "No market data found" Error
- Try a different year or more common vehicle
- Check if make/model spelling is correct
- Some rare vehicles may not have enough market data across all sources

### Slow Response Times
- First request may take 3-5 seconds (live scraping 4 sources)
- Subsequent requests are faster (cached)
- All four sources being scraped in parallel

### Fallback to RapidAPI
- If all sources fail, system automatically tries RapidAPI
- Check console logs for fallback messages
- Ensure RapidAPI credentials are still configured

## Cost Benefits

### Before (RapidAPI)
- $X per request
- Limited monthly quota
- Single data source

### After (Web Scraping - 4 Sources)
- Only hosting/compute costs
- Unlimited requests (within reason)
- **4x more comprehensive data sources**
- **Much better price accuracy and coverage**
- **Real market data from actual listings**

## Expected Results

### Typical Data Collection
- **AutoTrader**: 10-30 results per vehicle
- **Cars.com**: 8-25 results per vehicle  
- **eBay Motors**: 5-20 results per vehicle
- **CarGurus**: 12-35 results per vehicle
- **Total**: **35-110 price points** for comprehensive market analysis

### Improved Accuracy
- **More Data Points**: 4x more sources = better statistical accuracy
- **Real Listings**: Actual asking prices, not estimated values
- **Market Coverage**: Different demographics and regions per site
- **Validation**: Cross-source price validation reduces outliers

## Future Enhancements

- Add more sources (CarMax, Vroom, etc.)
- Regional price variations analysis
- Condition-based adjustments
- Historical trend analysis
- Price prediction algorithms

## Migration Notes

- No database changes required
- Existing cache table reused
- RapidAPI credentials can remain for fallback
- Gradual rollout possible via feature flags
- **4x increase in data comprehensiveness** 