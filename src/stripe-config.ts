export interface Product {
  priceId: string;
  name: string;
  description: string;
  mode: 'payment' | 'subscription';
  price: number;
  currency: string;
  interval?: 'month' | 'year';
}

export const products: Product[] = [
  {
    priceId: 'price_1RWufJHj6ln2Tety5ufKCZb5',
    name: 'PricePilot Pro',
    description: 'PricePilot Pro unlocks unlimited saved searches & instant price alerts, advanced 30-day price history charts, and priority filters (free shipping, seller location, Buy It Now). Enjoy voice-activated search, ad-free browsing, faster performance, and priority support. Get early access to features like reverse-image search and AI deal recommendations. Upgrade for smarter, hands-free eBay savings.',
    mode: 'subscription',
    price: 49.99,
    currency: 'USD',
    interval: 'year'
  },
  {
    priceId: 'price_1RWuedHj6ln2TetytOengyo7',
    name: 'PricePilot Pro',
    description: 'PricePilot Pro unlocks unlimited saved searches & instant price alerts, advanced 30-day price history charts, and priority filters (free shipping, seller location, Buy It Now). Enjoy voice-activated search, ad-free browsing, faster performance, and priority support. Get early access to features like reverse-image search and AI deal recommendations. Upgrade for smarter, hands-free eBay savings.',
    mode: 'subscription',
    price: 4.99,
    currency: 'USD',
    interval: 'month'
  }
];

export function getProductByPriceId(priceId: string): Product | undefined {
  return products.find(product => product.priceId === priceId);
}

export function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(price);
}