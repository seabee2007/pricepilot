async function refreshEbayToken() {
  try {
    // 🔧 REPLACE THESE WITH YOUR ACTUAL CREDENTIALS FROM https://developer.ebay.com/my/keys
    const clientId = 'YOUR_EBAY_CLIENT_ID'; // Paste your Client ID here
    const clientSecret = 'YOUR_EBAY_CLIENT_SECRET'; // Paste your Client Secret here
    
    if (clientId === 'YOUR_EBAY_CLIENT_ID' || clientSecret === 'YOUR_EBAY_CLIENT_SECRET') {
      console.log('❌ Please update your eBay credentials in this script:');
      console.log('');
      console.log('🔍 Steps:');
      console.log('   1. Go to https://developer.ebay.com/my/keys');
      console.log('   2. Copy your Client ID and Client Secret');
      console.log('   3. Replace the placeholder values above in this script');
      console.log('   4. Run this script again: node test-token.js');
      console.log('');
      console.log('🎯 Make sure your eBay app is configured for:');
      console.log('   - Application Type: Public Application');
      console.log('   - Grant Type: Client Credentials Grant');
      console.log('   - OAuth Scope: https://api.ebay.com/oauth/api_scope');
      return;
    }
    
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    // Use sandbox or production based on your clientId
    const oauthUrl = clientId.includes('SBX') 
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token';
    
    console.log('🔑 Testing OAuth with endpoint:', oauthUrl);
    console.log('🔑 Client ID (masked):', clientId.substring(0, 8) + '...');
    console.log('🔑 Environment:', clientId.includes('SBX') ? 'SANDBOX' : 'PRODUCTION');
    
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
      console.log(`supabase secrets set EBAY_OAUTH_TOKEN="${data.access_token}" --project-ref aaootfztturzzvuvdlfy`);
      console.log('');
      console.log('⏰ Note: This token expires in 2 hours. You can run this script again to refresh it.');
    } else {
      const errorText = await response.text();
      console.error('❌ OAuth failed:', response.status, errorText);
      
      if (errorText.includes('invalid_scope')) {
        console.log('');
        console.log('💡 SCOPE ERROR HELP:');
        console.log('   This means your eBay app does not have Browse API access.');
        console.log('   1. Go to https://developer.ebay.com/my/keys');
        console.log('   2. Check your app\'s "OAuth Scopes"');
        console.log('   3. It should include: https://api.ebay.com/oauth/api_scope');
        console.log('   4. If not, you may need to create a new app or contact eBay support');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Check if we're running this script directly
if (typeof require !== 'undefined' && require.main === module) {
  refreshEbayToken();
} 