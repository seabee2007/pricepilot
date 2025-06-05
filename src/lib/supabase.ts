import { createClient } from '@supabase/supabase-js';
import { SavedSearch, PriceHistory, SearchFilters } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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