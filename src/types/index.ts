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
  category?: string;
  conditionIds?: number[];
  freeShipping?: boolean;
  sellerLocation?: string;
  buyItNowOnly?: boolean;
  auctionOnly?: boolean;
  postalCode?: string;
  countryCode?: string;
  
  // Enhanced filters based on eBay Browse API
  priceRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  returnsAccepted?: boolean;
  searchInDescription?: boolean;
  sellerAccountType?: 'BUSINESS' | 'INDIVIDUAL';
  qualifiedPrograms?: ('EBAY_PLUS' | 'AUTHENTICITY_GUARANTEE' | 'AUTHENTICITY_VERIFICATION')[];
  excludeSellers?: string[];
  charityOnly?: boolean;
  itemEndDate?: {
    start?: string;
    end?: string;
  };
  itemLocationCountry?: string;
  deliveryCountry?: string;
  deliveryPostalCode?: string;
  
  // Automotive compatibility filters
  compatibilityFilter?: VehicleCompatibility;
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