import { Handler } from '@netlify/functions';
import fetch from 'node-fetch';
import FormData from 'form-data';

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // The request body is raw MP3 bytes
    const audioBuffer = Buffer.from(event.body!, 'base64');

    // Build multipart/form-data for ElevenLabs
    const form = new FormData();
    form.append('model_id', 'scribe_v1'); // per API docs
    form.append('file', audioBuffer, { filename: 'speech.mp3' });

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
      console.error('ElevenLabs error:', errJson);
      return {
        statusCode: elevenRes.status,
        body: JSON.stringify({ error: errJson }),
      };
    }

    const json = await elevenRes.json();
    // ElevenLabs returns { text: "…", words: […], language_code: "en" }
    return {
      statusCode: 200,
      body: JSON.stringify({ text: json.text }),
    };
  } catch (err: any) {
    console.error('Transcription handler failed:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

export { handler }; 