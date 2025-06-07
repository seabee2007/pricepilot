async function refreshEbayToken() {
  try {
    // Replace these with your actual credentials from eBay Developer Portal
    const clientId = 'YOUR_EBAY_CLIENT_ID'; // From https://developer.ebay.com/my/keys
    const clientSecret = 'YOUR_EBAY_CLIENT_SECRET'; // From https://developer.ebay.com/my/keys
    
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    // Use sandbox or production based on your clientId
    const oauthUrl = clientId.includes('SBX') 
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token';
    
    console.log('🔑 Testing OAuth with endpoint:', oauthUrl);
    console.log('🔑 Client ID (masked):', clientId.substring(0, 8) + '...');
    
    const response = await fetch(oauthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
    });
    
    console.log('📡 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ New token generated successfully!');
      console.log('📋 Token details:');
      console.log('  - Token type:', data.token_type);
      console.log('  - Expires in:', data.expires_in, 'seconds');
      console.log('  - Scope:', data.scope);
      console.log('  - Access token (first 20 chars):', data.access_token.substring(0, 20) + '...');
      console.log('');
      console.log('🔧 Update your Supabase secret with this token:');
      console.log(`npx supabase secrets set EBAY_OAUTH_TOKEN="${data.access_token}" --project-ref aaootfztturzzvuvdlfy`);
    } else {
      const errorText = await response.text();
      console.error('❌ OAuth failed:', response.status, errorText);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Check if we're running this script directly
if (typeof require !== 'undefined' && require.main === module) {
  refreshEbayToken();
} 