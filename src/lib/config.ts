// Configuration settings for PricePilot

export interface RateLimitConfig {
  minRequestInterval: number; // milliseconds between identical requests
  maxConcurrentRequests: number; // maximum simultaneous requests
  requestTimeout: number; // request timeout delay
  isTestingMode: boolean; // whether to show debug information
}

export interface AppConfig {
  rateLimit: RateLimitConfig;
  debug: {
    showConsoleMessages: boolean;
    showDebugPanel: boolean;
    showTestingBanner: boolean;
  };
}

// Testing configuration (strict rate limiting)
const testingConfig: AppConfig = {
  rateLimit: {
    minRequestInterval: 5000, // 5 seconds between identical requests
    maxConcurrentRequests: 3, // max 3 concurrent requests
    requestTimeout: 500, // 500ms delay before requests
    isTestingMode: true
  },
  debug: {
    showConsoleMessages: true,
    showDebugPanel: true,
    showTestingBanner: true
  }
};

// Production configuration (normal rate limiting)
const productionConfig: AppConfig = {
  rateLimit: {
    minRequestInterval: 1000, // 1 second between identical requests
    maxConcurrentRequests: 10, // max 10 concurrent requests
    requestTimeout: 100, // 100ms delay before requests
    isTestingMode: false
  },
  debug: {
    showConsoleMessages: false,
    showDebugPanel: false,
    showTestingBanner: false
  }
};

// Determine which config to use - only use testing mode when explicitly requested  
const isTestingMode = localStorage.getItem('pricepilot_testing_mode') === 'true' ||
                     new URLSearchParams(window.location.search).has('testing');

export const config: AppConfig = isTestingMode ? testingConfig : productionConfig;

// Helper functions to manage testing mode
export function enableTestingMode(): void {
  localStorage.setItem('pricepilot_testing_mode', 'true');
  window.location.reload();
}

export function disableTestingMode(): void {
  localStorage.removeItem('pricepilot_testing_mode');
  window.location.reload();
}

export function isInTestingMode(): boolean {
  return config.rateLimit.isTestingMode;
}

// Expose config controls to window for debugging
if (typeof window !== 'undefined') {
  (window as any).pricePilotConfig = {
    current: config,
    enableTesting: enableTestingMode,
    disableTesting: disableTestingMode,
    isTestingMode: isInTestingMode
  };
} 