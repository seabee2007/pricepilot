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
  
  // Automotive compatibility data
  compatibility?: ItemCompatibility;
}

export interface SearchFilters {
  conditionIds?: number[];
  freeShipping?: boolean;
  sellerLocation?: string;
  buyItNowOnly?: boolean;
  postalCode?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  vehicleAspects?: Record<string, string>;
}

// Individual saved item interface - simplified for items only
export interface SavedItem {
  id: string;
  user_id: string;
  
  // All items are individual eBay items now
  item_type: 'item';
  
  // Individual item fields
  item_id: string;
  title: string;
  price: number;
  currency: string;
  image_url?: string;
  item_url: string;
  condition?: string;
  seller_username?: string;
  seller_feedback_score?: number;
  seller_feedback_percentage?: string;
  shipping_cost?: number;
  shipping_currency?: string;
  buying_options?: string[];
  
  // Common fields
  notes?: string;
  price_alert_threshold?: number;
  last_checked_price?: number;
  created_at: string;
  updated_at: string;
}

// Type alias for individual items (now the only type)
export interface SavedItemIndividual extends SavedItem {
  item_type: 'item';
}

export interface PriceHistory {
  id: string;
  query: string;
  timestamp: string;
  avg_price: number;
}

// Enhanced price history interface for 30-day tracking
export interface DailyPricePoint {
  day: string;
  low_price: number;
  high_price: number;
  avg_price: number;
  data_points: number;
}

export type SearchMode = 'buy' | 'sell';

// Vehicle compatibility interfaces
export interface VehicleCompatibility {
  // For cars and trucks
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  engine?: string;
  
  // For motorcycles (alternative to trim/engine)
  submodel?: string;
  
  // Vehicle type to determine required fields
  vehicleType?: 'car' | 'truck' | 'motorcycle';
}

export interface CompatibilityProperty {
  name: string;
  value: string;
}

export interface ItemCompatibility {
  compatibilityStatus?: 'COMPATIBLE' | 'NOT_COMPATIBLE' | 'UNKNOWN';
  compatibilityMatch?: 'EXACT' | 'POSSIBLE' | 'NONE';
  compatibilityProperties?: CompatibilityProperty[];
}

// eBay Deal API types
export interface DealItem {
  itemId: string;
  title: string;
  image?: {
    imageUrl: string;
  };
  price: {
    value: number;
    currency: string;
  };
  originalPrice?: {
    value: number;
    currency: string;
  };
  discountAmount?: {
    value: number;
    currency: string;
  };
  discountPercentage?: string;
  dealStartDate?: string;
  dealEndDate?: string;
  itemWebUrl: string;
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
  categories?: {
    categoryId: string;
    categoryName: string;
  }[];
}

export interface EbayEvent {
  eventId: string;
  eventType: string;
  eventTitle: string;
  eventDescription?: string;
  startDate: string;
  endDate: string;
  eventStatus: 'ACTIVE' | 'UPCOMING' | 'ENDED';
  eventUrl?: string;
  applicableCoupons?: {
    couponId: string;
    couponType: string;
    redemptionCode?: string;
    discountAmount?: {
      value: number;
      currency: string;
    };
    discountPercentage?: string;
    minimumPurchaseAmount?: {
      value: number;
      currency: string;
    };
    maxDiscountAmount?: {
      value: number;
      currency: string;
    };
    expirationDate?: string;
  }[];
  eventTerms?: string;
  categories?: {
    categoryId: string;
    categoryName: string;
  }[];
}

export interface EventItem {
  itemId: string;
  eventId: string;
  title: string;
  image?: {
    imageUrl: string;
  };
  price: {
    value: number;
    currency: string;
  };
  originalPrice?: {
    value: number;
    currency: string;
  };
  eventPrice?: {
    value: number;
    currency: string;
  };
  discountAmount?: {
    value: number;
    currency: string;
  };
  discountPercentage?: string;
  itemWebUrl: string;
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
  categories?: {
    categoryId: string;
    categoryName: string;
  }[];
}

export interface DealSearchFilters {
  categoryIds?: string[];
  limit?: number;
  offset?: number;
}

export interface EventSearchFilters {
  categoryIds?: string[];
  eventIds?: string[];
  limit?: number;
  offset?: number;
}