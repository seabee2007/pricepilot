export interface ItemSummary {
  itemId: string;
  title: string;
  price: {
    value: number;
    currency: string;
  };
  image?: {
    imageUrl: string;
  };
  seller?: {
    username: string;
    feedbackPercentage?: string;
    feedbackScore?: number;
  };
  condition?: string;
  shippingOptions?: {
    shippingCost?: {
      value: number;
      currency: string;
    };
    shippingType?: string;
  }[];
  itemWebUrl: string;
  itemLocation?: {
    postalCode?: string;
    country?: string;
  };
  buyingOptions?: string[];
  listingStatus?: string;
  currentBidPrice?: {
    value: number;
    currency: string;
  };
}

export interface SearchFilters {
  conditionIds?: number[];
  freeShipping?: boolean;
  sellerLocation?: string;
  buyItNowOnly?: boolean;
  postalCode?: string;
  countryCode?: string;
}

export interface SavedSearch {
  id: string;
  user_id: string;
  query: string;
  filters: SearchFilters;
  price_threshold: number;
  last_checked_price: number | null;
  created_at: string;
}

export interface PriceHistory {
  id: string;
  query: string;
  timestamp: string;
  avg_price: number;
}

export type SearchMode = 'buy' | 'sell';