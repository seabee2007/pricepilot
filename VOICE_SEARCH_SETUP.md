# Voice Search Feature with ElevenLabs Speech-to-Text

PricePilot now includes advanced voice search functionality powered by **ElevenLabs Speech-to-Text API** for high-accuracy transcription.

## How It Works

The voice search feature uses:
1. **MediaRecorder API** to capture high-quality audio from the user's microphone
2. **ElevenLabs Speech-to-Text API** for professional-grade transcription
3. **Netlify Functions** for serverless audio processing

## Setup Requirements

### 1. ElevenLabs API Key
1. Sign up at [https://elevenlabs.io](https://elevenlabs.io)
2. Get your API key from "API Keys" in the dashboard
3. Add to your environment variables:
   ```
   ELEVEN_API_KEY=your_elevenlabs_api_key_here
   ```

### 2. Netlify Environment Variables
In your Netlify site settings → Build & deploy → Environment variables:
```
ELEVEN_API_KEY = your_elevenlabs_api_key_here
```

## Browser Support

- **Chrome**: Full support ✅
- **Edge**: Full support ✅
- **Safari**: Full support ✅
- **Firefox**: Full support ✅

*Much wider browser support than Web Speech API*

## How to Use

1. **Click the microphone icon** in the search input field
2. **Allow microphone access** when prompted by your browser
3. **Start speaking** - you'll see a red pulsing microphone with animated dot
4. **Click the microphone again** to stop recording
5. **Wait for transcription** - audio is sent to ElevenLabs for processing
6. **Review the transcribed text** in the search field
7. **Click Search** or press Enter to search eBay

## Features

- **High-accuracy transcription** using ElevenLabs' professional models
- **Real-time visual feedback** during recording
- **Comprehensive error handling** for network and audio issues
- **Automatic language detection** (optimized for English)
- **Superior noise handling** compared to browser-based solutions

## Visual Indicators

- **Gray microphone**: Ready to record
- **Red pulsing microphone with animated dot**: Currently recording
- **Toast notifications**: Status updates, transcription results, and error messages
- **Smooth transitions** and hover effects

## Technical Implementation

### Frontend (MediaRecorder)
- Captures audio using `MediaRecorder` with WebM format
- Records in chunks for optimal processing
- Sends raw audio bytes to serverless function

### Backend (Netlify Function)
- Receives audio as `ArrayBuffer`
- Creates `multipart/form-data` with `model_id: "scribe_v1"`
- Posts to `https://api.elevenlabs.io/v1/speech-to-text`
- Returns transcribed text to frontend

### API Integration
```typescript
// Netlify Function
const form = new FormData();
form.append('model_id', 'scribe_v1');
form.append('file', new Blob([audioBuffer]), 'recording.webm');

const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
  method: 'POST',
  headers: { 'xi-api-key': process.env.ELEVEN_API_KEY },
  body: form,
});
```

## Error Handling

### Common Issues and Solutions

**"Microphone access denied"**
- Solution: Click the microphone icon in browser address bar and allow access

**"No microphone found"**
- Solution: Check that microphone is connected and not being used by another app

**"Transcription failed"**
- Solution: Check network connection and ensure ElevenLabs API key is configured

**"No audio recorded"**
- Solution: Ensure microphone is working and speak during recording

**"ElevenLabs API key not configured"**
- Solution: Add `ELEVEN_API_KEY` to your environment variables

## Advantages over Web Speech API

1. **Better Accuracy**: Professional-grade transcription models
2. **Wider Browser Support**: Works in all modern browsers
3. **Language Support**: Superior handling of accents and dialects
4. **Noise Handling**: Better performance in noisy environments
5. **Consistency**: Same quality across all platforms and browsers

## API Response Format

ElevenLabs returns detailed transcription data:
```json
{
  "language_code": "en",
  "language_probability": 1.0,
  "text": "2011 Dodge Durango intake manifold",
  "words": [
    {
      "text": "2011",
      "type": "word",
      "start": 0.0,
      "end": 0.5,
      "speaker_id": "speaker_0"
    }
    // ... more word-level details
  ]
}
```

## Cost Considerations

- ElevenLabs offers generous free tiers for development
- Production usage is pay-per-use based on audio duration
- Typical search queries cost fractions of a penny
- Consider implementing client-side audio optimization for cost efficiency

## Security

- Audio data is processed securely through ElevenLabs' encrypted endpoints
- No audio data is stored permanently
- API keys are server-side only, never exposed to client
- HTTPS required for microphone access in production

## Future Enhancements

- **Real-time transcription**: Stream audio for live transcription
- **Multiple language support**: Auto-detect and support various languages
- **Voice commands**: "Search for [item] under [price]"
- **Accent optimization**: Fine-tune models for specific regions
- **Offline fallback**: Use Web Speech API when ElevenLabs is unavailable 