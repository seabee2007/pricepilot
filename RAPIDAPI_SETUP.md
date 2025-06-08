# RapidAPI Vehicle Pricing Setup

This guide will help you set up the RapidAPI Vehicle Pricing API integration for PricePilot.

## 1. Get RapidAPI Account & API Key

1. **Sign up for RapidAPI**: Go to [RapidAPI.com](https://rapidapi.com) and create a free account
2. **Subscribe to Vehicle Pricing API**: Search for "Vehicle Pricing API" and subscribe to a plan
3. **Get your API Key**: Copy your RapidAPI key from the dashboard

## 2. Configure Environment Variables

In your Supabase dashboard, go to **Project Settings → API → Environment Variables** and add:

```ini
RAPIDAPI_KEY=your_rapidapi_key_here
RAPIDAPI_HOST=vehicle-pricing-api.p.rapidapi.com
```

## 3. Deploy Edge Function

The `get-vehicle-value` Edge Function should already be deployed. If you need to redeploy:

```bash
supabase functions deploy get-vehicle-value
```

## 4. Test the Integration

1. Search for a vehicle on PricePilot (e.g., "2020 Audi A3")
2. The VehicleValueCard should appear above the eBay results
3. Click "Get Market Value" to fetch pricing data
4. Historical data will be saved and displayed over time

## Features

- **Market Value Lookup**: Get current market value for any vehicle
- **Historical Tracking**: 30-day price history with trends
- **Smart Caching**: 24-hour cache to reduce API costs
- **Auto-Detection**: Automatically shows for vehicle searches
- **Optional Parameters**: Support for mileage, trim, and ZIP code

## API Costs

- The Vehicle Pricing API has various pricing tiers
- Caching reduces API calls (24-hour cache per vehicle)
- Monitor your usage in the RapidAPI dashboard

## Troubleshooting

### "API configuration missing" error
- Check that `RAPIDAPI_KEY` is set in Supabase environment variables
- Ensure the Edge Function is deployed

### No vehicle value card showing
- Make sure your search includes vehicle-related terms
- Check browser console for any errors

### Rate limiting
- The API has rate limits based on your subscription plan
- Upgrade your RapidAPI plan if needed

## Support

For issues with the Vehicle Pricing API itself, contact RapidAPI support.
For PricePilot integration issues, check the browser console for error messages. 