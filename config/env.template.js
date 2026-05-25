// Environment Configuration Template
// Copy this file to env.js and fill in your actual values

export const ENV_CONFIG = {
  // Microsoft Authentication
  MICROSOFT_CLIENT_ID: 'your-microsoft-client-id-here',
  MICROSOFT_TENANT_ID: 'common', // or your specific tenant ID
  MICROSOFT_REDIRECT_URI: 'expense://auth',
  
  // App Configuration
  APP_SCHEME: 'expense',
  
  // Development flags
  DEBUG: true,
  ENABLE_LOGGING: true,
};

// Instructions:
// 1. Copy this file to env.js
// 2. Replace the placeholder values with your actual configuration
// 3. Add env.js to your .gitignore to keep secrets safe
// 4. Import and use this configuration in your app
