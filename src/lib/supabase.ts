import { createClient } from '@supabase/supabase-js';
import { SavedSearch, PriceHistory, SearchFilters } from '../types';
import { SubscriptionData } from './stripe';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

export async function getSavedSearches(): Promise<SavedSearch[]> {
  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
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
): Promise<SavedSearch> {
  const user = supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User must be logged in to save searches');
  }

  const { data, error } = await supabase
    .from('saved_searches')
    .insert({
      query,
      filters,
      price_threshold: priceThreshold,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving search:', error);
    throw error;
  }

  return data;
}

export async function deleteSavedSearch(id: string): Promise<void> {
  const { error } = await supabase
    .from('saved_searches')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting saved search:', error);
    throw error;
  }
}

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

export async function savePriceHistory(
  query: string,
  avgPrice: number
): Promise<void> {
  const { error } = await supabase
    .from('price_history')
    .insert({
      query,
      avg_price: avgPrice,
    });

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