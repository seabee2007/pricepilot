import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Search, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './ui/Button';
import Checkbox from './ui/Checkbox';
import LocationSelector from './LocationSelector';
import { SearchMode, SearchFilters } from '../types';
import { LocationData } from '../lib/location';
import { haptic } from '../lib/haptics';
import toast from 'react-hot-toast';
import { Recorder } from 'vmsg';

interface SearchFormProps {
  mode: SearchMode;
}

// Create recorder instance but don't initialize it yet
const createRecorder = () => new Recorder({
  wasmURL: '/vmsg.wasm',
  shimURL: '/vmsg.js',
});

const SearchForm = ({ mode }: SearchFormProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState<Recorder | null>(null);
  
  // Filter states
  const [category, setCategory] = useState('all');
  const [conditionIds, setConditionIds] = useState<number[]>([]);
  const [freeShipping, setFreeShipping] = useState(false);
  const [sellerLocation, setSellerLocation] = useState('');
  const [buyItNowOnly, setBuyItNowOnly] = useState(false);
  const [userLocation, setUserLocation] = useState<LocationData>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    // Build filters object
    const filters: SearchFilters = {
      conditionIds,
      category,
      freeShipping,
      sellerLocation,
      buyItNowOnly,
      postalCode: userLocation.postalCode,
      countryCode: userLocation.countryCode
    };
    
    // Convert filters to URL-friendly format
    const filtersParam = encodeURIComponent(JSON.stringify(filters));
    
    // Navigate to results page
    navigate(`/results?mode=${mode}&q=${encodeURIComponent(query)}&filters=${filtersParam}`);
  };

  // Initialize recorder only when needed
  const initializeRecorder = async () => {
    try {
      const newRecorder = createRecorder();
      await newRecorder.init();
      setRecorder(newRecorder);
      return newRecorder;
    } catch (err) {
      console.error('Failed to initialize recorder:', err);
      haptic('error');
      toast.error('Could not initialize voice recording. Please check microphone permissions.');
      return null;
    }
  };

  // Start recording from mic
  const startRecording = async () => {
    try {
      // Initialize recorder if not already initialized
      const rec = recorder || await initializeRecorder();
      if (!rec) return;

      setIsRecording(true);
      await rec.initAudio();
      await rec.initWorker();
      rec.startRecording();
      haptic('medium');
      toast.success('Recording started. Click the mic again to stop and transcribe.');
    } catch (err: any) {
      console.error('Cannot start recording:', err);
      haptic('error');
      toast.error('Microphone access is required for voice search.');
      setIsRecording(false);
    }
  };

  // Stop recording, get blob, send to ElevenLabs
  const stopRecording = async () => {
    if (!recorder) return;

    try {
      setIsLoading(true);
      haptic('light');
      const blob = await recorder.stopRecording();
      setIsRecording(false);

      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => {
          const base64 = reader.result?.toString().split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      
      const base64Data = await base64Promise;

      // POST to our /api/transcribe route
      const response = await fetch('/.netlify/functions/transcribe', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio: base64Data,
          mimeType: blob.type || 'audio/mpeg',
        }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        console.error('Transcription failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorJson,
        });
        haptic('error');
        toast.error(`Voice transcription failed (${response.status}). Try again.`);
        setIsLoading(false);
        return;
      }

      const { text } = await response.json();
      setIsLoading(false);
      if (text && text.trim()) {
        setQuery(text.trim());
        haptic('success');
        toast.success('Voice search transcribed successfully!');
      } else {
        haptic('warning');
        toast.error('Could not transcribe speech. Try again.');
      }
    } catch (err: any) {
      console.error('Error processing recording:', err);
      haptic('error');
      toast.error('Recording failed. Please try again.');
      setIsLoading(false);
      setIsRecording(false);
    }
  };

  const handleVoiceSearch = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const handleConditionChange = (conditionId: number) => {
    setConditionIds(prev => 
      prev.includes(conditionId)
        ? prev.filter(id => id !== conditionId)
        : [...prev, conditionId]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto">
      <div className="mb-6">
        {/* eBay-style search header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className={`text-2xl font-bold ${mode === 'buy' ? 'text-blue-600 dark:text-blue-500' : 'text-green-600 dark:text-green-500'}`}>
            {mode === 'buy' ? 'Find anything' : 'Sell your item'}
          </h1>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Search like eBay
          </div>
        </div>

        {/* eBay-style search bar */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="appearance-none w-full sm:w-44 px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg sm:rounded-r-none text-gray-700 dark:text-gray-200 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              <option value="electronics">Electronics</option>
              <option value="fashion">Fashion</option>
              <option value="home">Home & Garden</option>
              <option value="sporting">Sporting Goods</option>
              <option value="toys">Toys & Hobbies</option>
              <option value="business">Business & Industrial</option>
              <option value="jewelry">Jewelry & Watches</option>
              <option value="motors">Motors</option>
              <option value="collectibles">Collectibles</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          <div className="flex flex-1 gap-2">
            <div className="relative flex-grow">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your search"
                className="w-full px-4 py-3 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:ring-blue-400 text-base"
                required
              />
              <button
                type="button"
                onClick={handleVoiceSearch}
                disabled={isLoading}
                title={isRecording ? "Click to stop recording" : "Click to start voice search"}
                className={`absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors duration-200 ${
                  isRecording 
                    ? 'text-red-500 animate-pulse' 
                    : 'text-gray-400 hover:text-blue-500 dark:hover:text-blue-400'
                }`}
              >
                {isRecording ? (
                  <div className="relative">
                    <Mic className="h-6 w-6" />
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                  </div>
                ) : (
                  <Mic className="h-6 w-6" />
                )}
              </button>
            </div>

            <div className="relative">
              <button
                type="submit"
                disabled={!query.trim() || isLoading}
                className="appearance-none w-full sm:w-44 px-4 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 border border-blue-600 dark:border-blue-600 rounded-lg sm:rounded-l-none rounded-r-lg text-white font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center"
              >
                <Search className="h-5 w-5 mr-2" />
                Search
                {isLoading && <div className="absolute right-3 top-1/2 transform -translate-y-1/2"><Loader2 className="h-4 w-4 animate-spin" /></div>}
              </button>
            </div>
          </div>
        </div>

        {/* Advanced search toggle */}
        <div className="mt-2 text-right">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {showAdvanced ? (
              <>
                Hide Advanced Search
                <ChevronUp className="ml-1 w-4 h-4" />
              </>
            ) : (
              <>
                Show Advanced Search
                <ChevronDown className="ml-1 w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Advanced Filters</h3>
              
              <div className="space-y-6">
                {/* Location Selector */}
                <LocationSelector
                  onLocationChange={setUserLocation}
                  initialLocation={userLocation}
                  disabled={isLoading}
                />

                {/* Condition Filter */}
                <div className="space-y-2">
                  <label className="block text-lg font-bold text-gray-700 dark:text-gray-300 text-center">
                    Item Condition
                  </label>
                  <div className="flex flex-wrap justify-center gap-4">
                    {[
                      { id: 1000, label: 'New' },
                      { id: 3000, label: 'Used' },
                      { id: 2000, label: 'Refurbished' }
                    ].map(condition => (
                      <div key={condition.id} className="flex items-center">
                        <Checkbox
                          checked={conditionIds.includes(condition.id)}
                          onChange={() => handleConditionChange(condition.id)}
                          label={condition.label}
                          disabled={isLoading}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Shipping and Purchase Options */}
                <div className="space-y-2">
                  <label className="block text-lg font-bold text-gray-700 dark:text-gray-300 text-center">
                    Shipping & Purchase Options
                  </label>
                  <div className="flex flex-wrap justify-center gap-4">
                    <div className="flex items-center">
                      <Checkbox
                        checked={freeShipping}
                        onChange={() => setFreeShipping(!freeShipping)}
                        label="Free Shipping Only"
                        disabled={isLoading}
                      />
                    </div>
                    <div className="flex items-center">
                      <Checkbox
                        checked={buyItNowOnly}
                        onChange={() => setBuyItNowOnly(!buyItNowOnly)}
                        label="Buy It Now Only"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Seller Location Filter */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Seller Location
                  </label>
                  <select
                    value={sellerLocation}
                    onChange={(e) => setSellerLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  >
                    <option value="">Any Location</option>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GB">United Kingdom</option>
                    <option value="AU">Australia</option>
                    <option value="DE">Germany</option>
                    <option value="FR">France</option>
                    <option value="IT">Italy</option>
                    <option value="ES">Spain</option>
                    <option value="JP">Japan</option>
                  </select>
                </div>

                {/* Advanced Search Button */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(false)}
                      className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Hide Advanced Search
                    </button>
                    <Button
                      type="submit"
                      disabled={!query.trim() || isLoading}
                      className={`px-8 ${mode === 'buy' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                      isLoading={isLoading}
                      icon={<Search className="h-5 w-5" />}
                    >
                      Search with Filters
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
};

export default SearchForm;