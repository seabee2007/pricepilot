# PricePilot eBay Price Tracking App

## Testing Phase - Rate Limiting Features

🧪 **Testing Mode is currently active** with strict rate limiting to ensure stability:

- **5 second cooldown** between identical requests
- **Maximum 3 concurrent requests** at any time
- **Debug information** visible in browser console and UI
- **Real-time monitoring** of request status

### Debug Features Available

When running in development mode, you'll see:

1. **Testing Banner** - Shows current rate limit settings
2. **Debug Panel** - Real-time request monitoring with:
   - Total request count
   - Current status (Loading/Ready)
   - Rate limit status
   - Last request timestamp
   - Countdown timer for next allowed request

3. **Browser Console Tools** - Open DevTools console and access:
   ```javascript
   // Check current configuration
   window.pricePilotConfig.current
   
   // Toggle testing mode on/off
   window.pricePilotConfig.enableTesting()
   window.pricePilotConfig.disableTesting()
   
   // Cache management tools
   window.pricePilotCache.health()      // Check system health
   window.pricePilotCache.clear()       // Clear app cache
   window.pricePilotCache.reset()       // Emergency reset
   window.pricePilotCache.manage()      // Interactive management
   ```

### Error Handling

The app now gracefully handles:
- ✅ **Rate limit exceeded** - Shows countdown timer
- ✅ **Too many concurrent requests** - Queues requests properly  
- ✅ **Resource exhaustion** - Prevents infinite loops
- ✅ **Network issues** - Provides helpful error messages

### Testing Instructions

1. Navigate to `http://localhost:5178`
2. Try searching for any item (e.g., "iPhone 14")
3. Notice the testing banner and debug panel
4. Try multiple rapid searches to see rate limiting in action
5. Check browser console for detailed logs
6. If you encounter issues, use `window.pricePilotCache.manage()` in console

## Setup Instructions

### Getting eBay API Credentials

# PricePilot

A powerful eBay price tracking and comparison tool built with React, TypeScript, and Supabase.

## Features

- **eBay Search Integration**: Search live eBay listings with advanced filtering
- **Smart Category Detection**: Automatic eBay category detection for improved search relevance
- **Price Tracking**: Save items and track price changes over time  
- **Compatibility Checking**: Vehicle parts compatibility verification
- **Deal Discovery**: Find eBay deals and promotional events
- **Authentication**: Secure user accounts with Supabase Auth
- **Real-time Data**: Live pricing and inventory information

## Smart Category Detection System

PricePilot now includes intelligent category detection that automatically identifies the best eBay category for your search queries, dramatically improving search result relevance.

### How It Works

1. **Automatic Detection**: When you search for items like "iPhone 15", the system automatically detects this should search in "Cell Phones & Accessories"
2. **Keyword Matching**: Uses advanced keyword matching with synonyms (e.g., "phone" matches "mobile", "smartphone", "cellular")
3. **Relevance Scoring**: Prioritizes more specific categories and exact keyword matches
4. **Smart Exclusions**: Automatically skips category detection for vehicle searches to preserve existing automotive logic
5. **Graceful Fallback**: If category detection fails, searches continue without categories

### Benefits

- **Better Results**: No more seeing screen protectors when searching for phones
- **Improved Relevance**: eBay's algorithm works better with proper categories
- **Automatic**: No manual category selection required
- **Fast**: 24-hour caching ensures quick response times

### Technical Implementation

- **eBay Taxonomy API**: Fetches complete category tree with 24-hour caching
- **Edge Functions**: Server-side processing via Supabase for security
- **TypeScript**: Full type safety and developer experience
- **Error Handling**: Robust fallback mechanisms

## Setup
