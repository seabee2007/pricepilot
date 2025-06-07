import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Button from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Force page reload if it's a resource error
    if (this.state.error?.message.includes('ERR_INSUFFICIENT_RESOURCES') || 
        this.state.error?.message.includes('Rate limit exceeded')) {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isRateLimit = this.state.error?.message.includes('Rate limit exceeded');
      const isResourceError = this.state.error?.message.includes('ERR_INSUFFICIENT_RESOURCES');

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white text-center mb-2">
              {isRateLimit || isResourceError ? 'Too Many Requests' : 'Something went wrong'}
            </h2>
            
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              {isRateLimit || isResourceError 
                ? 'We detected too many requests in a short time. Please wait a moment before trying again.'
                : 'An unexpected error occurred. Please try refreshing the page.'
              }
            </p>

            {(isRateLimit || isResourceError) && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                  Why did this happen?
                </h3>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• Multiple identical searches were made too quickly</li>
                  <li>• The browser ran out of network resources</li>
                  <li>• An infinite loop was detected and stopped</li>
                </ul>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={this.handleReset}
                className="flex-1"
                icon={<RefreshCw className="w-4 h-4" />}
              >
                Try Again
              </Button>
              <Button
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="flex-1"
              >
                Go Home
              </Button>
            </div>

            {this.state.error && (
              <details className="mt-4">
                <summary className="text-sm text-gray-500 cursor-pointer">
                  Technical Details
                </summary>
                <pre className="mt-2 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 