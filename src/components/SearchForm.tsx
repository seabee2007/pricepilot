import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Search, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './ui/Button';
import Checkbox from './ui/Checkbox';
import LocationSelector from './LocationSelector';
import { SearchMode, SearchFilters } from '../types';
import { LocationData } from '../lib/location';
import toast from 'react-hot-toast';

interface SearchFormProps {
  mode: SearchMode;
}

const SearchForm = ({ mode }: SearchFormProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
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
    const filters: SearchFilters = {};
    
    if (category !== 'all') {
      filters.category = category;
    }
    
    if (conditionIds.length > 0) {
      filters.conditionIds = conditionIds;
    }
    
    if (freeShipping) {
      filters.freeShipping = true;
    }
    
    if (sellerLocation) {
      filters.sellerLocation = sellerLocation;
    }
    
    if (buyItNowOnly) {
      filters.buyItNowOnly = true;
    }
    
    // Add location data for better search results
    if (userLocation.postalCode) {
      filters.postalCode = userLocation.postalCode;
    }
    
    if (userLocation.countryCode) {
      filters.countryCode = userLocation.countryCode;
    }
    
    // Convert filters to URL-friendly format
    const filtersParam = encodeURIComponent(JSON.stringify(filters));
    
    // Navigate to results page
    navigate(`/results?mode=${mode}&q=${encodeURIComponent(query)}&filters=${filtersParam}`);
  };

  // Start recording from mic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e: BlobEvent) => {
        audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        
        try {
          // Combine chunks into one Blob
          const audioBlob = new Blob(audioChunksRef.current, {
            type: 'audio/webm',
          });
          
          if (audioBlob.size === 0) {
            toast.error('No audio recorded. Please try again.');
            return;
          }
          
          const arrayBuffer = await audioBlob.arrayBuffer();

          // POST raw bytes to /.netlify/functions/transcribe
          const res = await fetch('/.netlify/functions/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: arrayBuffer,
          });
          
          if (!res.ok) {
            const errorData = await res.json();
            console.error('Transcription failed', errorData);
            toast.error(`Transcription failed: ${errorData.error || 'Unknown error'}`);
            return;
          }
          
          const { text } = await res.json();
          if (text && text.trim()) {
            setQuery(text.trim());
            toast.success('Voice search transcribed successfully!');
          } else {
            toast.error('No speech detected. Please try again.');
          }
        } catch (error: any) {
          console.error('Transcription error:', error);
          toast.error(`Transcription failed: ${error.message}`);
        }
      };

      recorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event.error);
        toast.error('Recording failed. Please try again.');
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      toast.success('Recording started. Click the mic again to stop and transcribe.');
    } catch (err: any) {
      console.error('Microphone access error:', err);
      
      if (err.name === 'NotAllowedError') {
        toast.error('Microphone access denied. Please allow microphone access and try again.');
      } else if (err.name === 'NotFoundError') {
        toast.error('No microphone found. Please check your audio devices.');
      } else {
        toast.error('Voice search unavailable. Please check your microphone.');
      }
      
      setIsRecording(false);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleVoiceSearch = async () => {
    if (isRecording) {
      stopRecording();
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
                placeholder={mode === 'buy' ? "Enter your search keyword" : "What are you selling?"}
                className="w-full px-4 py-3 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:ring-blue-400 text-base"
                required
              />
              <button
                type="button"
                onClick={handleVoiceSearch}
                disabled={isRecording}
                title={isRecording ? "Click to stop recording" : "Click to start voice search"}
                className={`absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors duration-200 ${
                  isRecording 
                    ? 'text-red-500 animate-pulse' 
                    : 'text-gray-400 hover:text-blue-500 dark:hover:text-blue-400'
                }`}
              >
                {isRecording ? (
                  <div className="relative">
                    <Mic className="h-5 w-5" />
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                  </div>
                ) : (
                  <Mic className="h-5 w-5" />
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
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block text-center sm:text-left">
                    Item Condition
                  </label>
                  <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-2">
                    {[
                      { id: 1000, label: 'New' },
                      { id: 3000, label: 'Used' },
                      { id: 2000, label: 'Refurbished' }
                    ].map(condition => (
                      <div key={condition.id} className="flex items-start justify-center sm:justify-start">
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
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block text-center sm:text-left">
                    Shipping & Purchase Options
                  </label>
                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                    <div className="flex items-start justify-center sm:justify-start">
                      <Checkbox
                        checked={freeShipping}
                        onChange={() => setFreeShipping(!freeShipping)}
                        label="Free Shipping Only"
                        disabled={isLoading}
                      />
                    </div>
                    <div className="flex items-start justify-center sm:justify-start">
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