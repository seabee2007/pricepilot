# eBay API Setup for PricePilot

## Getting eBay API Credentials

1. Go to [eBay Developers Program](https://developer.ebay.com/)
2. Sign up or log in with your eBay account
3. Navigate to "My Account" → "Keys"
4. Create a new application or use an existing one
5. Get your **Client ID** and **Client Secret** from the "Application Keys" section

## Environment Variables

Create a `.env` file in your project root with:

```env
# eBay API Credentials  
VITE_EBAY_CLIENT_ID=your_ebay_client_id_here
VITE_EBAY_CLIENT_SECRET=your_ebay_client_secret_here

# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## eBay Browse API Implementation

The implementation now follows the canonical eBay Browse API pattern:

### Live Listings (Buy Mode)
```
GET https://api.ebay.com/buy/browse/v1/item_summary/search
  ?q=2011%20Dodge%20Durango%20upper%20intake%20manifold
  &filter=conditionIds:{1000},shippingOptions:{FREE_SHIPPING},buyingOptions:{FIXED_PRICE},sellerLocation:{US}
  &sort=price
  &limit=20
  &buyerPostalCode=90210
```

### Completed Listings (Sell Mode)
```
GET https://api.ebay.com/buy/browse/v1/item_summary/completed
  ?q=2011%20Dodge%20Durango%20upper%20intake%20manifold
  &filter=conditionIds:{1000}
  &sort=price_desc
  &limit=20
```

## Filter Options

- `conditionIds:{1000}` - New items only
- `conditionIds:{3000}` - Used items only  
- `conditionIds:{2000}` - Refurbished items only
- `shippingOptions:{FREE_SHIPPING}` - Free shipping only
- `buyingOptions:{FIXED_PRICE}` - Buy It Now only (no auctions)
- `sellerLocation:{US}` - US sellers only

## Running the App

1. Install dependencies: `npm install`
2. Set up environment variables
3. Start development server: `npm run dev`
4. The app will be available at `http://localhost:5173` 