import React, { useState, useEffect } from 'react';
import { DealItem, EbayEvent, EventItem } from '../types';
import { 
  getDealItems, 
  getEbayEvents, 
  getEventItems, 
  calculateDealSavings,
  checkDealApiAccess 
} from '../lib/ebay';

export const EbayDealsExplorer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'deals' | 'events' | 'event-items'>('deals');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiAccess, setApiAccess] = useState<{ available: boolean; message: string } | null>(null);

  // Deal items state
  const [dealItems, setDealItems] = useState<DealItem[]>([]);
  const [dealSavings, setDealSavings] = useState<{ totalSavings: number; averageDiscount: number; bestDeal: DealItem | null } | null>(null);

  // Events state
  const [events, setEvents] = useState<EbayEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EbayEvent | null>(null);

  // Event items state
  const [eventItems, setEventItems] = useState<EventItem[]>([]);

  // Check API access on component mount
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const access = await checkDealApiAccess();
        setApiAccess(access);
      } catch (err) {
        setApiAccess({
          available: false,
          message: 'Unable to check Deal API access'
        });
      }
    };

    checkAccess();
  }, []);

  const loadDealItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await getDealItems({ limit: 50 });
      setDealItems(items);
      setDealSavings(calculateDealSavings(items));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deal items');
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const eventList = await getEbayEvents({ limit: 20 });
      setEvents(eventList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const loadEventItems = async (eventIds?: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const items = await getEventItems({ 
        eventIds,
        limit: 50 
      });
      setEventItems(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event items');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: 'deals' | 'events' | 'event-items') => {
    setActiveTab(tab);
    setError(null);
    
    if (tab === 'deals' && dealItems.length === 0) {
      loadDealItems();
    } else if (tab === 'events' && events.length === 0) {
      loadEvents();
    } else if (tab === 'event-items' && eventItems.length === 0) {
      loadEventItems();
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency 
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // If API access is not available, show access message
  if (apiAccess && !apiAccess.available) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">eBay Deals & Events</h2>
          <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center justify-center mb-4">
              <svg className="w-12 h-12 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Limited Release API</h3>
            <p className="text-yellow-700 mb-4">{apiAccess.message}</p>
            <div className="text-sm text-yellow-600">
              <p className="mb-2">To access the eBay Deal API in production, you need:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Special approval from eBay business units</li>
                <li>Meeting standard eligibility requirements</li>
                <li>Signing contracts with eBay</li>
              </ul>
              <div className="mt-4">
                <a 
                  href="https://developer.ebay.com/api-docs/buy/deal/overview.html" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                >
                  Learn More About Deal API Access
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">eBay Deals & Events Explorer</h2>
      
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => handleTabChange('deals')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'deals'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Deal Items
        </button>
        <button
          onClick={() => handleTabChange('events')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'events'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Events
        </button>
        <button
          onClick={() => handleTabChange('event-items')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'event-items'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Event Items
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading...</span>
        </div>
      )}

      {/* Deal Items Tab */}
      {activeTab === 'deals' && !loading && (
        <div>
          {dealSavings && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="text-lg font-semibold text-green-800 mb-2">Savings Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-green-600">Total Potential Savings</p>
                  <p className="text-xl font-bold text-green-800">
                    {formatCurrency(dealSavings.totalSavings)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-green-600">Average Discount</p>
                  <p className="text-xl font-bold text-green-800">
                    {dealSavings.averageDiscount.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-green-600">Best Deal</p>
                  <p className="text-sm font-semibold text-green-800">
                    {dealSavings.bestDeal?.title.substring(0, 40)}...
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dealItems.map((item) => (
              <div key={item.itemId} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                {item.image && (
                  <img
                    src={item.image.imageUrl}
                    alt={item.title}
                    className="w-full h-48 object-cover rounded-md mb-3"
                  />
                )}
                
                <h4 className="font-semibold text-sm mb-2 line-clamp-2">{item.title}</h4>
                
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(item.price.value, item.price.currency)}
                    </span>
                    {item.originalPrice && (
                      <span className="text-sm text-gray-500 line-through">
                        {formatCurrency(item.originalPrice.value, item.originalPrice.currency)}
                      </span>
                    )}
                  </div>
                  
                  {item.discountPercentage && (
                    <div className="text-sm font-semibold text-red-600">
                      Save {item.discountPercentage}
                    </div>
                  )}
                  
                  {item.discountAmount && (
                    <div className="text-sm text-green-600">
                      You save: {formatCurrency(item.discountAmount.value, item.discountAmount.currency)}
                    </div>
                  )}
                </div>

                {(item.dealStartDate || item.dealEndDate) && (
                  <div className="text-xs text-gray-500 mb-3">
                    {item.dealStartDate && <div>Starts: {formatDate(item.dealStartDate)}</div>}
                    {item.dealEndDate && <div>Ends: {formatDate(item.dealEndDate)}</div>}
                  </div>
                )}

                <a
                  href={item.itemWebUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  View Deal on eBay
                </a>
              </div>
            ))}
          </div>

          {dealItems.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-gray-500">No deal items found.</p>
              <button
                onClick={loadDealItems}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Refresh Deal Items
              </button>
            </div>
          )}
        </div>
      )}

      {/* Events Tab */}
      {activeTab === 'events' && !loading && (
        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.eventId} className="border border-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{event.eventTitle}</h3>
                  <span className={`inline-block px-2 py-1 text-xs rounded ${
                    event.eventStatus === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                    event.eventStatus === 'UPCOMING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {event.eventStatus}
                  </span>
                </div>
                <div className="text-right text-sm text-gray-500">
                  <div>Starts: {formatDate(event.startDate)}</div>
                  <div>Ends: {formatDate(event.endDate)}</div>
                </div>
              </div>

              {event.eventDescription && (
                <p className="text-gray-600 mb-4">{event.eventDescription}</p>
              )}

              {event.applicableCoupons && event.applicableCoupons.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold text-sm mb-2">Available Coupons:</h4>
                  <div className="space-y-2">
                    {event.applicableCoupons.map((coupon, index) => (
                      <div key={index} className="p-3 bg-blue-50 border border-blue-200 rounded">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{coupon.couponType}</span>
                          {coupon.discountPercentage && (
                            <span className="text-blue-600 font-bold">{coupon.discountPercentage} OFF</span>
                          )}
                          {coupon.discountAmount && (
                            <span className="text-blue-600 font-bold">
                              {formatCurrency(coupon.discountAmount.value, coupon.discountAmount.currency)} OFF
                            </span>
                          )}
                        </div>
                        {coupon.redemptionCode && (
                          <div className="text-sm text-gray-600 mt-1">
                            Code: <span className="font-mono">{coupon.redemptionCode}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {event.eventUrl && (
                  <a
                    href={event.eventUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    View Event
                  </a>
                )}
                <button
                  onClick={() => {
                    setActiveTab('event-items');
                    loadEventItems([event.eventId]);
                  }}
                  className="px-4 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                >
                  View Event Items
                </button>
              </div>
            </div>
          ))}

          {events.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-gray-500">No events found.</p>
              <button
                onClick={loadEvents}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Refresh Events
              </button>
            </div>
          )}
        </div>
      )}

      {/* Event Items Tab */}
      {activeTab === 'event-items' && !loading && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {eventItems.map((item) => (
              <div key={`${item.eventId}-${item.itemId}`} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                {item.image && (
                  <img
                    src={item.image.imageUrl}
                    alt={item.title}
                    className="w-full h-48 object-cover rounded-md mb-3"
                  />
                )}
                
                <h4 className="font-semibold text-sm mb-2 line-clamp-2">{item.title}</h4>
                
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(item.price.value, item.price.currency)}
                    </span>
                    {item.originalPrice && (
                      <span className="text-sm text-gray-500 line-through">
                        {formatCurrency(item.originalPrice.value, item.originalPrice.currency)}
                      </span>
                    )}
                  </div>
                  
                  {item.eventPrice && (
                    <div className="text-sm font-semibold text-blue-600">
                      Event Price: {formatCurrency(item.eventPrice.value, item.eventPrice.currency)}
                    </div>
                  )}
                  
                  {item.discountPercentage && (
                    <div className="text-sm font-semibold text-red-600">
                      Save {item.discountPercentage}
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-500 mb-3">
                  Event ID: {item.eventId}
                </div>

                <a
                  href={item.itemWebUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  View Item on eBay
                </a>
              </div>
            ))}
          </div>

          {eventItems.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-gray-500">No event items found.</p>
              <button
                onClick={() => loadEventItems()}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Load All Event Items
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 