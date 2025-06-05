import FormData from 'form-data';
import fetch from 'node-fetch';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import 'dotenv/config';

interface HandlerEvent {
  body: string | null;
  isBase64Encoded?: boolean;
}

interface HandlerResponse {
  statusCode: number;
  body: string;
}

const eleven = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY!,
});

const handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'No audio data provided' }),
    };
  }

  try {
    // Read raw MP3 bytes from the request body
    const audioBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'binary');

    // Build a multipart/form-data request, per ElevenLabs docs
    const form = new FormData();
    form.append('file', audioBuffer, { filename: 'speech.mp3' });
    form.append('modelId', 'scribe_v1');          // required
    form.append('languageCode', 'eng');           // optional, "eng" = English
    form.append('diarize', 'false');              // optional, false means no speaker tagging

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
      return {
        statusCode: elevenRes.status,
        body: JSON.stringify({ error: errJson }),
      };
    }

    const json = await elevenRes.json();
    // json shape: { text: "...", words: [...], language_code: "eng", ... }
    return {
      statusCode: 200,
      body: JSON.stringify({ text: json.text }),
    };
  } catch (err: any) {
    console.error('Transcription handler error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

export { handler }; 