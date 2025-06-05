import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export function calculateSavings(marketPrice: number, itemPrice: number): number {
  if (marketPrice <= 0 || itemPrice <= 0) return 0;
  return ((marketPrice - itemPrice) / marketPrice) * 100;
}

export function getConditionName(conditionId?: number): string {
  switch (conditionId) {
    case 1000: return 'New';
    case 1500: return 'New - Other';
    case 1750: return 'New with defects';
    case 2000: return 'Certified Refurbished';
    case 2500: return 'Seller Refurbished';
    case 3000: return 'Used';
    case 4000: return 'Very Good';
    case 5000: return 'Good';
    case 6000: return 'Acceptable';
    case 7000: return 'For parts or not working';
    default: return 'Not Specified';
  }
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