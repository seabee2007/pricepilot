import FormData from 'form-data';
import fetch from 'node-fetch';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import 'dotenv/config';

interface HandlerEvent {
  body: string | null;
  isBase64Encoded?: boolean;
  headers?: { [key: string]: string };
}

interface AudioRequest {
  audio: string;
  mimeType: string;
}

interface HandlerResponse {
  statusCode: number;
  body: string;
}

// Check if API key is available
if (!process.env.ELEVENLABS_API_KEY) {
  console.error('ELEVENLABS_API_KEY environment variable is not set');
}

const eleven = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY!,
});

const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  console.log('Request headers:', event.headers);
  
  if (!event.body) {
    console.log('No body provided in request');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'No audio data provided' }),
    };
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('Missing ELEVENLABS_API_KEY environment variable');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error - missing API key' }),
    };
  }

  try {
    // Parse the JSON request body
    const request: AudioRequest = JSON.parse(event.body);
    
    if (!request.audio) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No audio data provided in request body' }),
      };
    }

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(request.audio, 'base64');
    console.log('Audio buffer size:', audioBuffer.length, 'bytes');
    console.log('Audio MIME type:', request.mimeType);

    // Build a multipart/form-data request with snake_case keys as per ElevenLabs API
    const form = new FormData();
    form.append('file', audioBuffer, {
      filename: 'speech.mp3',
      contentType: request.mimeType || 'audio/mpeg',
    });
    form.append('model_id', 'scribe_v1');        // snake_case
    form.append('language_code', 'eng');         // snake_case
    form.append('diarize', 'false');             // unchanged as it's already correct

    console.log('Sending request to ElevenLabs with form data headers:', form.getHeaders());

    // Send to ElevenLabs' /v1/speech-to-text endpoint
    const elevenRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        ...form.getHeaders(),
      },
      body: form as any,
    });

    if (!elevenRes.ok) {
      const errJson = await elevenRes.json().catch(() => ({}));
      console.error('ElevenLabs STT error:', errJson);
      console.error('ElevenLabs response status:', elevenRes.status);
      console.error('ElevenLabs response headers:', elevenRes.headers);
      return {
        statusCode: elevenRes.status,
        body: JSON.stringify({ 
          error: errJson,
          message: 'Failed to transcribe audio',
          status: elevenRes.status,
        }),
      };
    }

    const json = await elevenRes.json();
    console.log('Successfully transcribed audio:', json);
    return {
      statusCode: 200,
      body: JSON.stringify({ text: json.text }),
    };
  } catch (err: any) {
    console.error('Transcription handler error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: err.message,
        stack: err.stack,
      }),
    };
  }
};

export { handler }; 