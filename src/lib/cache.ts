// Cache management utilities for PricePilot

/**
 * Clear all browser storage related to PricePilot
 * This can help resolve stuck states and infinite loops
 */
export function clearAppCache(): void {
  try {
    // Clear localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('supabase.') || key.includes('pricepilot') || key === 'theme')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Clear sessionStorage
    const sessionKeysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith('supabase.') || key.includes('pricepilot'))) {
        sessionKeysToRemove.push(key);
      }
    }
    sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));

    console.log('App cache cleared successfully');
  } catch (error) {
    console.error('Error clearing app cache:', error);
  }
}

/**
 * Clear service worker cache if present
 */
export async function clearServiceWorkerCache(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }

    console.log('Service worker cache cleared successfully');
  } catch (error) {
    console.error('Error clearing service worker cache:', error);
  }
}

/**
 * Force reload the page with cache bypass
 */
export function forceReload(): void {
  // Try to reload with cache bypass
  if ('location' in window) {
    window.location.reload();
  }
}

/**
 * Check if the browser is experiencing resource issues
 */
export function checkResourceHealth(): {
  memoryIssue: boolean;
  networkIssue: boolean;
  recommendations: string[];
} {
  const recommendations: string[] = [];
  let memoryIssue = false;
  let networkIssue = false;

  // Check memory usage if available
  if ('memory' in performance && (performance as any).memory) {
    const memory = (performance as any).memory;
    const memoryUsage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
    
    if (memoryUsage > 0.8) {
      memoryIssue = true;
      recommendations.push('High memory usage detected. Try closing other tabs or restarting your browser.');
    }
  }

  // Check network connection
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      networkIssue = true;
      recommendations.push('Slow network connection detected. Consider waiting for a better connection.');
    }
  }

  // Check if there are too many open connections
  if ((performance as any).getEntriesByType) {
    const networkEntries = (performance as any).getEntriesByType('navigation');
    if (networkEntries.length > 0) {
      const entry = networkEntries[0];
      if (entry.loadEventEnd - entry.loadEventStart > 10000) {
        networkIssue = true;
        recommendations.push('Page load time is very slow. Try refreshing or checking your internet connection.');
      }
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('System appears healthy.');
  }

  return {
    memoryIssue,
    networkIssue,
    recommendations
  };
}

/**
 * Emergency reset - clears everything and reloads
 */
export async function emergencyReset(): Promise<void> {
  try {
    console.log('Performing emergency reset...');
    
    // Clear all caches
    clearAppCache();
    await clearServiceWorkerCache();
    
    // Small delay to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Force reload
    forceReload();
  } catch (error) {
    console.error('Error during emergency reset:', error);
    // Fallback: just reload
    window.location.href = window.location.origin;
  }
}

/**
 * Display cache management options to user
 */
export function showCacheManagement(): void {
  const health = checkResourceHealth();
  
  const message = [
    'PricePilot Cache Management',
    '',
    'System Health:',
    ...health.recommendations,
    '',
    'Actions:',
    '1. Clear app cache and reload',
    '2. Emergency reset (clears everything)',
    '3. Just reload page',
    '',
    'Choose action (1-3):'
  ].join('\n');

  const choice = prompt(message);
  
  switch (choice) {
    case '1':
      clearAppCache();
      forceReload();
      break;
    case '2':
      emergencyReset();
      break;
    case '3':
      forceReload();
      break;
    default:
      console.log('Cache management cancelled');
  }
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).pricePilotCache = {
    clear: clearAppCache,
    clearServiceWorker: clearServiceWorkerCache,
    reload: forceReload,
    health: checkResourceHealth,
    reset: emergencyReset,
    manage: showCacheManagement
  };
} 