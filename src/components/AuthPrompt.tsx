import { useNavigate } from 'react-router-dom';
import { UserPlus, LogIn, Search, Shield } from 'lucide-react';
import Button from './ui/Button';

interface AuthPromptProps {
  query?: string;
  mode?: 'buy' | 'sell';
  title?: string;
  description?: string;
}

const AuthPrompt = ({ 
  query = '',
  mode = 'buy',
  title = 'Sign in to search eBay',
  description = 'Create a free account or sign in to search for the best deals on eBay.'
}: AuthPromptProps) => {
  const navigate = useNavigate();

  const handleSignIn = () => {
    // Store the current search context to return to after sign in
    if (query) {
      sessionStorage.setItem('pendingSearch', JSON.stringify({ query, mode }));
    }
    navigate('/signin');
  };

  const handleSignUp = () => {
    // Store the current search context to return to after sign up
    if (query) {
      sessionStorage.setItem('pendingSearch', JSON.stringify({ query, mode }));
    }
    navigate('/signup');
  };

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
      <div className="flex justify-center mb-6">
        <div className="relative">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <Search className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <Shield className="h-3 w-3 text-red-600 dark:text-red-400" />
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
        {title}
      </h2>
      
      <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
        {description}
      </p>

      {query && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            You were searching for:
          </p>
          <p className="font-medium text-gray-900 dark:text-gray-100">
            "{query}" in {mode === 'buy' ? 'Buy' : 'Sell'} mode
          </p>
        </div>
      )}

      <div className="space-y-3">
        <Button
          onClick={handleSignIn}
          className="w-full"
          size="lg"
          icon={<LogIn className="h-5 w-5" />}
        >
          Sign In
        </Button>
        
        <Button
          onClick={handleSignUp}
          variant="outline"
          className="w-full"
          size="lg"
          icon={<UserPlus className="h-5 w-5" />}
        >
          Create Free Account
        </Button>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center">
            <Shield className="h-4 w-4 mr-1" />
            <span>Secure</span>
          </div>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
          <div className="flex items-center">
            <span>Free Forever</span>
          </div>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
          <div className="flex items-center">
            <span>No Spam</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
        Why do I need to sign in? We use secure authentication to access eBay's API 
        and provide you with real-time pricing data while keeping your searches private.
      </p>
    </div>
  );
};

export default AuthPrompt; 