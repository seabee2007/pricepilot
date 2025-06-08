import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency: string = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(value);
}

export function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function calculateSavings(marketPrice: number, itemPrice: number): number {
  if (marketPrice <= 0 || itemPrice <= 0) return 0;
  return ((marketPrice - itemPrice) / marketPrice) * 100;
}

export function getConditionName(conditionId: number): string {
  const conditions: Record<number, string> = {
    1000: "New",
    1500: "New other (see details)",
    1750: "New with defects",
    2000: "Manufacturer refurbished",
    2500: "Seller refurbished",
    3000: "Used",
    4000: "Very Good",
    5000: "Good",
    6000: "Acceptable",
    7000: "For parts or not working"
  };
  
  return conditions[conditionId] || "Unknown";
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Utility function to safely format timestamps
export function formatTimestamp(raw: string | undefined | null): string {
  if (!raw) return '—';
  
  const ts = new Date(raw);
  if (isNaN(ts.getTime())) {
    return '—';
  }
  
  return ts.toLocaleString();
}

// Utility function to safely format dates (date only, no time)
export function formatDate(raw: string | undefined | null): string {
  if (!raw) return '—';
  
  const ts = new Date(raw);
  if (isNaN(ts.getTime())) {
    return '—';
  }
  
  return ts.toLocaleDateString();
}