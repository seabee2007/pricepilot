import { useState, useEffect, useRef, useCallback } from 'react';

// Debounce hook for delaying function execution
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Hook for preventing duplicate function calls
export function useDeduplicatedCallback<T extends (...args: any[]) => Promise<any>>(
  callback: T,
  keyGenerator: (...args: Parameters<T>) => string,
  delay: number = 100
): T {
  const activeRequests = useRef<Map<string, Promise<any>>>(new Map());
  const timeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const debouncedCallback = useCallback(
    async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      const key = keyGenerator(...args);
      
      // Clear any existing timeout for this key
      const existingTimeout = timeouts.current.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Check if we already have an active request
      const existingRequest = activeRequests.current.get(key);
      if (existingRequest) {
        console.log(`🔄 Deduplicating request for key: ${key}`);
        return existingRequest;
      }

      // Create a new debounced promise
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(async () => {
          try {
            const request = callback(...args);
            activeRequests.current.set(key, request);
            
            const result = await request;
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            activeRequests.current.delete(key);
            timeouts.current.delete(key);
          }
        }, delay);
        
        timeouts.current.set(key, timeoutId);
      });
    },
    [callback, keyGenerator, delay]
  ) as T;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeouts.current.forEach(timeout => clearTimeout(timeout));
      timeouts.current.clear();
      activeRequests.current.clear();
    };
  }, []);

  return debouncedCallback;
}

// Hook for managing loading states with automatic cleanup
export function useAsyncState<T>(
  initialState: T | null = null
): [
  T | null,
  boolean,
  string | null,
  (asyncFn: () => Promise<T>) => Promise<void>,
  () => void
] {
  const [data, setData] = useState<T | null>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const execute = useCallback(async (asyncFn: () => Promise<T>) => {
    if (!mountedRef.current) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await asyncFn();
      if (mountedRef.current) {
        setData(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        console.error('Async state error:', err);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const reset = useCallback(() => {
    setData(initialState);
    setError(null);
    setLoading(false);
  }, [initialState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return [data, loading, error, execute, reset];
}

// Hook for throttling function calls
export function useThrottle<T>(value: T, interval: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastExecuted = useRef<number>(Date.now());

  useEffect(() => {
    if (Date.now() >= lastExecuted.current + interval) {
      lastExecuted.current = Date.now();
      setThrottledValue(value);
    } else {
      const timerId = setTimeout(() => {
        lastExecuted.current = Date.now();
        setThrottledValue(value);
      }, interval);

      return () => clearTimeout(timerId);
    }
  }, [value, interval]);

  return throttledValue;
} 