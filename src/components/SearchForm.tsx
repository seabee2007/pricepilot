import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Search, Loader2 } from 'lucide-react';
import Button from './ui/Button';
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
  const [conditionIds, setConditionIds] = useState<number[]>([]);
  const [freeShipping, setFreeShipping] = useState(false);
  const [sellerLocation, setSellerLocation] = useState('');
  const [buyItNowOnly, setBuyItNowOnly] = useState(false);
  const [userLocation, setUserLocation] = useState<LocationData>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    // Build filters object
    const filters: SearchFilters = {};
    
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
      <div className="mb-6 relative">
        <div className="flex">
          <div className="relative flex-grow">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={mode === 'buy' ? "What are you looking to buy?" : "What are you selling?"}
              className="w-full px-4 py-3 pr-12 rounded-l-md border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:focus:ring-blue-400"
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
          <Button
            type="submit"
            disabled={!query.trim() || isLoading}
            className={`rounded-l-none ${mode === 'buy' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
            isLoading={isLoading}
            icon={<Search className="h-4 w-4" />}
          >
            Search
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Search Filters</h3>
        
        <div className="space-y-6">
          {/* Location Selector */}
          <LocationSelector
            onLocationChange={setUserLocation}
            initialLocation={userLocation}
            disabled={isLoading}
          />

          {/* Condition Filter */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">
              Item Condition
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 1000, label: 'New' },
                { id: 3000, label: 'Used' },
                { id: 2000, label: 'Refurbished' }
              ].map(condition => (
                <label 
                  key={condition.id} 
                  className="flex items-center space-x-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={conditionIds.includes(condition.id)}
                    onChange={() => handleConditionChange(condition.id)}
                    className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{condition.label}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Shipping and Purchase Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={freeShipping}
                  onChange={() => setFreeShipping(!freeShipping)}
                  className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Free Shipping Only</span>
              </label>
            </div>
            
            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={buyItNowOnly}
                  onChange={() => setBuyItNowOnly(!buyItNowOnly)}
                  className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Buy It Now Only</span>
              </label>
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
        </div>
      </div>
    </form>
  );
};

export default SearchForm;