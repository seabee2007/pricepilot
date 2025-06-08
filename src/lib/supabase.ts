import { createClient } from '@supabase/supabase-js';
import { SavedSearch, SavedItem, PriceHistory, SearchFilters, ItemSummary } from '../types';
import { SubscriptionData } from './stripe';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});

// Auth Types
export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  preferred_location?: string;
  notification_preferences: {
    email_alerts: boolean;
    price_drops: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface SignUpData {
  email: string;
  password: string;
  fullName?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface ResetPasswordData {
  email: string;
}

export interface UpdatePasswordData {
  password: string;
}

// Enhanced price history interface for 30-day tracking
export interface DailyPricePoint {
  day: string;
  low_price: number;
  high_price: number;
  avg_price: number;
  data_points: number;
}

// Authentication Functions
export async function signUp({ email, password, fullName }: SignUpData) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: undefined, // Disable email confirmation
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signIn({ email, password }: SignInData) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    throw error;
  }
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    throw error;
  }
  
  return user;
}

export async function getProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data;
}

export async function updateProfile(updates: Partial<Profile>) {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('No user logged in');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// Saved Searches Functions (now consolidated into Saved Items)
export async function getSavedSearches(): Promise<SavedItem[]> {
  const { data, error } = await supabase
    .from('saved_items')
    .select('*')
    .eq('item_type', 'search')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching saved searches:', error);
    throw error;
  }

  return data || [];
}

export async function saveSearch(
  query: string,
  filters: SearchFilters,
  priceThreshold: number
): Promise<void> {
  const { error } = await supabase
    .from('saved_items')
    .insert({
      item_type: 'search',
      search_query: query,
      search_filters: filters,
      price_alert_threshold: priceThreshold,
    });

  if (error) {
    console.error('Error saving search:', error);
    throw error;
  }
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const { error } = await supabase
    .from('saved_items')
    .delete()
    .eq('id', id)
    .eq('item_type', 'search');

  if (error) {
    console.error('Error deleting saved search:', error);
    throw error;
  }
}

// Unified Saved Items Functions
export async function getAllSavedItems(): Promise<SavedItem[]> {
  const { data, error } = await supabase
    .from('saved_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching saved items:', error);
    throw error;
  }

  return data || [];
}

export async function getSavedItemsByType(itemType: 'item' | 'search'): Promise<SavedItem[]> {
  const { data, error } = await supabase
    .from('saved_items')
    .select('*')
    .eq('item_type', itemType)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`Error fetching saved ${itemType}s:`, error);
    throw error;
  }

  return data || [];
}

export async function saveIndividualItem(item: ItemSummary, priceAlertThreshold?: number): Promise<void> {
  const { error } = await supabase
    .from('saved_items')
    .insert({
      item_type: 'item',
      item_id: item.itemId,
      title: item.title,
      price: item.price.value,
      currency: item.price.currency,
      image_url: item.image?.imageUrl,
      item_url: item.itemWebUrl,
      condition: item.condition,
      seller_username: item.seller?.username,
      seller_feedback_score: item.seller?.feedbackScore,
      seller_feedback_percentage: item.seller?.feedbackPercentage,
      shipping_cost: item.shippingOptions?.[0]?.shippingCost?.value,
      shipping_currency: item.shippingOptions?.[0]?.shippingCost?.currency,
      buying_options: item.buyingOptions,
      price_alert_threshold: priceAlertThreshold,
    });

  if (error) {
    console.error('Error saving individual item:', error);
    throw error;
  }
}

export async function saveSearchQuery(
  query: string,
  filters: SearchFilters,
  priceThreshold: number
): Promise<void> {
  const { error } = await supabase
    .from('saved_items')
    .insert({
      item_type: 'search',
      search_query: query,
      search_filters: filters,
      price_alert_threshold: priceThreshold,
    });

  if (error) {
    console.error('Error saving search query:', error);
    throw error;
  }
}

export async function updateSavedItem(id: string, updates: Partial<SavedItem>): Promise<void> {
  const { error } = await supabase
    .from('saved_items')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating saved item:', error);
    throw error;
  }
}

export async function deleteSavedItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('saved_items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting saved item:', error);
    throw error;
  }
}

export async function checkIfItemSaved(itemId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('saved_items')
    .select('id')
    .eq('item_type', 'item')
    .eq('item_id', itemId)
    .limit(1);

  if (error) {
    console.error('Error checking if item is saved:', error);
    return false;
  }

  return (data?.length || 0) > 0;
}

export async function checkIfSearchSaved(query: string, filters: SearchFilters): Promise<boolean> {
  const { data, error } = await supabase
    .from('saved_items')
    .select('id')
    .eq('item_type', 'search')
    .eq('search_query', query)
    .limit(1);

  if (error) {
    console.error('Error checking if search is saved:', error);
    return false;
  }

  return (data?.length || 0) > 0;
}

// Enhanced Price History Functions
export async function getPriceHistory(query: string): Promise<PriceHistory[]> {
  const { data, error } = await supabase
    .from('price_history')
    .select('*')
    .eq('query', query)
    .order('timestamp', { ascending: true })
    .limit(30);

  if (error) {
    console.error('Error fetching price history:', error);
    throw error;
  }

  return data || [];
}

export async function get30DayPriceHistory(searchId?: string, query?: string): Promise<DailyPricePoint[]> {
  try {
    let result;
    
    if (searchId) {
      console.log('Fetching 30-day history by search ID:', searchId);
      result = await supabase.rpc('get_30d_price_history', { 
        p_search_id: searchId 
      });
    } else if (query) {
      console.log('Fetching 30-day history by query:', query);
      result = await supabase.rpc('get_30d_price_history_by_query', { 
        p_query: query 
      });
    } else {
      throw new Error('Either searchId or query must be provided');
    }

    if (result.error) {
      console.error('RPC Error details:', result.error);
      throw result.error;
    }

    console.log('30-day price history result:', result);

    return (result.data || []).map((item: any) => ({
      day: item.day,
      low_price: parseFloat(item.low_price) || 0,
      high_price: parseFloat(item.high_price) || 0,
      avg_price: parseFloat(item.avg_price) || 0,
      data_points: parseInt(item.data_points) || 0
    }));
  } catch (error) {
    console.error('Error in get30DayPriceHistory:', error);
    throw error;
  }
}

export async function savePriceHistory(
  query: string,
  avgPrice: number,
  searchId?: string,
  minPrice?: number,
  maxPrice?: number
): Promise<void> {
  const insertData: any = {
    query,
    avg_price: avgPrice,
  };

  if (searchId) {
    insertData.search_id = searchId;
  }

  if (minPrice !== undefined) {
    insertData.min_price = minPrice;
  }

  if (maxPrice !== undefined) {
    insertData.max_price = maxPrice;
  }

  // Also set the individual price field for compatibility
  insertData.price = avgPrice;

  const { error } = await supabase
    .from('price_history')
    .insert(insertData);

  if (error) {
    console.error('Error saving price history:', error);
    throw error;
  }
}

export async function resetPassword({ email }: ResetPasswordData) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function updatePassword({ password }: UpdatePasswordData) {
  const { data, error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    throw error;
  }

  return data;
}

// Stripe Integration Functions
export async function getUserSubscription(): Promise<SubscriptionData | null> {
  const { data, error } = await supabase
    .from('stripe_user_subscriptions')
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Error fetching subscription:', error);
    throw error;
  }

  return data;
}

export async function getUserOrders() {
  const { data, error } = await supabase
    .from('stripe_user_orders')
    .select('*')
    .order('order_date', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }

  return data || [];
}

// Test function to manually trigger price alerts
export async function triggerPriceAlertsManually(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('🧪 Triggering price alerts manually...');

    // Check environment variables
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing environment variables:', { 
        hasUrl: !!supabaseUrl, 
        hasAnonKey: !!supabaseAnonKey 
      });
      return { 
        success: false, 
        message: 'Environment variables not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' 
      };
    }

    const functionUrl = `${supabaseUrl}/functions/v1/check-price-alerts`;
    console.log('📡 Function URL:', functionUrl);
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      return { 
        success: false, 
        message: 'Authentication required to trigger price alerts. Please sign in first.' 
      };
    }

    console.log('🔑 Authentication token available, making request...');

    // Try using Supabase client first (handles auth and CORS better)
    try {
      console.log('📡 Attempting to invoke via Supabase client...');
      
      const { data, error } = await supabase.functions.invoke('check-price-alerts', {
        body: { 
          trigger: 'manual',
          timestamp: new Date().toISOString()
        }
      });

      if (error) {
        console.error('❌ Supabase client error:', error);
        throw error;
      }

      console.log('✅ Supabase client success:', data);
      return { 
        success: true, 
        message: data?.message || 'Price alerts check completed successfully! Check your email if any price drops were found.' 
      };
      
    } catch (supabaseError) {
      console.error('❌ Supabase client failed, falling back to direct fetch...', supabaseError);
      
      // Fallback to direct fetch request
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          trigger: 'manual',
          timestamp: new Date().toISOString()
        }),
      });

      console.log('📥 Fetch response status:', response.status, response.statusText);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
          console.error('❌ Response error data:', errorData);
        } catch (parseError) {
          console.error('❌ Could not parse error response');
          try {
            const errorText = await response.text();
            console.error('❌ Error response text:', errorText);
            if (errorText) {
              errorMessage = errorText;
            }
          } catch (textError) {
            console.error('❌ Could not get error response text');
          }
        }
        
        return { 
          success: false, 
          message: `Request failed: ${errorMessage}` 
        };
      }

      const data = await response.json();
      console.log('✅ Fetch success response:', data);
      
      return { 
        success: true, 
        message: data?.message || 'Price alerts check completed successfully! Check your email if any price drops were found.' 
      };
    }
    
  } catch (error) {
    console.error('💥 Error triggering price alerts:', error);
    
    // Provide specific error messages
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      return { 
        success: false, 
        message: 'Network error: Unable to connect to the Edge Function. Please ensure the function is deployed and accessible.' 
      };
    }
    
    return { 
      success: false, 
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}` 
    };
  }
}

// Debug function to force send a test email
export async function sendTestEmail(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('📧 Sending test email...');

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      return { 
        success: false, 
        message: 'Authentication required. Please sign in first.' 
      };
    }

    const { data, error } = await supabase.functions.invoke('check-price-alerts', {
      body: { 
        trigger: 'test-email',
        forceEmail: true,
        timestamp: new Date().toISOString()
      }
    });

    if (error) {
      console.error('❌ Error sending test email:', error);
      return { 
        success: false, 
        message: `Test email failed: ${error.message}` 
      };
    }

    console.log('✅ Test email response:', data);
    return { 
      success: true, 
      message: data?.message || 'Test email sent successfully! Check your inbox.' 
    };
    
  } catch (error) {
    console.error('💥 Error sending test email:', error);
    return { 
      success: false, 
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}` 
    };
  }
}