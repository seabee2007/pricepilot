import { useState } from 'react';
import { Check, Crown, Loader2 } from 'lucide-react';
import Button from '../components/ui/Button';
import { products, formatPrice } from '../stripe-config';
import { createCheckoutSession, getSuccessUrl, getCancelUrl } from '../lib/stripe';
import { getCurrentUser } from '../lib/supabase';
import toast from 'react-hot-toast';

const PricingPage = () => {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string) => {
    try {
      const user = await getCurrentUser();
      
      if (!user) {
        toast.error('Please sign in to subscribe');
        return;
      }

      setLoadingPriceId(priceId);

      const { url } = await createCheckoutSession({
        price_id: priceId,
        success_url: getSuccessUrl(),
        cancel_url: getCancelUrl(),
        mode: 'subscription',
      });

      if (url) {
        window.location.href = url;
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout');
    } finally {
      setLoadingPriceId(null);
    }
  };

  const features = [
    'Unlimited saved searches',
    'Instant price drop alerts',
    'Advanced 30-day price history charts',
    'Priority filters (free shipping, seller location, Buy It Now)',
    'Voice-activated search',
    'Ad-free browsing experience',
    'Faster performance',
    'Priority customer support',
    'Early access to new features',
    'Reverse-image search (coming soon)',
    'AI deal recommendations (coming soon)',
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
          <span className="block text-gray-900 dark:text-white">Upgrade to</span>
          <span className="block text-blue-600 dark:text-blue-500">PricePilot Pro</span>
        </h1>
        <p className="mt-3 max-w-md mx-auto text-base text-gray-500 dark:text-gray-400 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
          Unlock the full power of PricePilot with unlimited searches, instant alerts, and advanced features.
        </p>
      </div>

      {/* Features Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-8">
          What's Included in Pro
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center space-x-3">
              <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
              <span className="text-gray-700 dark:text-gray-300">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {products.map((product) => (
          <div
            key={product.priceId}
            className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border-2 ${
              product.interval === 'year' 
                ? 'border-blue-500 relative' 
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            {product.interval === 'year' && (
              <div className="absolute top-0 right-0 bg-blue-500 text-white px-3 py-1 text-sm font-medium rounded-bl-lg">
                Best Value
              </div>
            )}
            
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                <Crown className="h-8 w-8 text-yellow-500 mr-2" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {product.name}
                </h3>
              </div>
              
              <div className="text-center mb-6">
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
                    {formatPrice(product.price)}
                  </span>
                  <span className="text-xl text-gray-500 dark:text-gray-400 ml-1">
                    /{product.interval}
                  </span>
                </div>
                {product.interval === 'year' && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                    Save 58% compared to monthly
                  </p>
                )}
              </div>

              <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 leading-relaxed">
                {product.description}
              </p>

              <Button
                onClick={() => handleSubscribe(product.priceId)}
                disabled={loadingPriceId === product.priceId}
                className={`w-full ${
                  product.interval === 'year'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-600 hover:bg-gray-700'
                }`}
                size="lg"
              >
                {loadingPriceId === product.priceId ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Subscribe ${product.interval === 'year' ? 'Yearly' : 'Monthly'}`
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* FAQ Section */}
      <div className="mt-16 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-8">
          Frequently Asked Questions
        </h2>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Can I cancel anytime?
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Yes, you can cancel your subscription at any time. You'll continue to have access to Pro features until the end of your billing period.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              What payment methods do you accept?
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              We accept all major credit cards including Visa, Mastercard, American Express, and Discover. Payments are processed securely through Stripe.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Is there a free trial?
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              You can use PricePilot's basic features for free. Pro features are available immediately upon subscription with no trial period.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              How do price alerts work?
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              With Pro, you can save unlimited searches and set price thresholds. We'll monitor eBay prices and notify you instantly when items drop below your target price.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;