import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Crown, ArrowRight } from 'lucide-react';
import Button from '../components/ui/Button';
import { getUserSubscription } from '../lib/supabase';
import { getProductByPriceId } from '../stripe-config';

const SuccessPage = () => {
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const userSubscription = await getUserSubscription();
        setSubscription(userSubscription);
      } catch (error) {
        console.error('Error fetching subscription:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  const getSubscriptionDetails = () => {
    if (!subscription || !subscription.price_id) {
      return null;
    }

    const product = getProductByPriceId(subscription.price_id);
    return product;
  };

  const product = getSubscriptionDetails();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
              Welcome to PricePilot Pro!
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Your subscription has been activated successfully.
            </p>

            {loading ? (
              <div className="mt-6 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto mt-2"></div>
              </div>
            ) : product ? (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-center mb-2">
                  <Crown className="h-5 w-5 text-yellow-500 mr-2" />
                  <span className="font-semibold text-blue-900 dark:text-blue-100">
                    {product.name}
                  </span>
                </div>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {product.interval === 'year' ? 'Annual' : 'Monthly'} Subscription
                </p>
              </div>
            ) : (
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Subscription details will be available shortly.
                </p>
              </div>
            )}

            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                What's Next?
              </h3>
              <div className="text-left space-y-3">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Unlimited Saved Searches
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Save as many searches as you want with custom price alerts
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Advanced Price History
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      View detailed 30-day price trends and analytics
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Voice Search & Premium Filters
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Use voice commands and access priority filtering options
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <Link to="/">
                <Button className="w-full">
                  Start Searching
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              
              <Link to="/saved-searches">
                <Button variant="outline" className="w-full">
                  View Saved Searches
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuccessPage;