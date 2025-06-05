import { Handler } from '@netlify/functions';
import fetch from 'node-fetch';
import FormData from 'form-data';

interface HandlerEvent {
  body: string | null;
  isBase64Encoded?: boolean;
}

interface HandlerResponse {
  statusCode: number;
  body: string;
}

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'No audio data provided' }),
    };
  }

  try {
    // Convert base64 to buffer if needed
    const audioBuffer = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body);

    // Send to ElevenLabs API
    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY || '',
        'Content-Type': 'audio/webm',
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('ElevenLabs API error:', error);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'Speech-to-text conversion failed' }),
      };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify({ text: data.text }),
    };
  } catch (error: any) {
    console.error('Transcription error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};

export { handler }; 