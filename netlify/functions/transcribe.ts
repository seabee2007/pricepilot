// Netlify function for ElevenLabs Speech-to-Text
export const handler = async (event: any, context: any) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    if (!process.env.ELEVEN_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'ElevenLabs API key not configured' }),
      };
    }

    // Read the raw bytes from the request body
    const audioBuffer = Buffer.from(event.body || '', 'base64');
    
    if (audioBuffer.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No audio data provided' }),
      };
    }

    // Build multipart/form-data manually
    const form = new FormData();
    form.append('model_id', 'scribe_v1'); // required
    form.append('file', new Blob([audioBuffer]), 'recording.webm');

    // POST to ElevenLabs STT endpoint
    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVEN_API_KEY!,
        // Note: fetch will set the correct Content-Type with FormData's boundary
      },
      body: form,
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      console.error('ElevenLabs STT error:', errorJson);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: errorJson }),
      };
    }

    const json = await response.json();
    // json has shape: { language_code, language_probability, text, words: [ … ] }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ text: json.text }),
    };

  } catch (err: any) {
    console.error('Transcription handler error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
}; 