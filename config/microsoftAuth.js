// Microsoft Authentication Configuration
// Replace these values with your actual Azure App Registration details

export const MICROSOFT_AUTH_CONFIG = {
  //  Azure App Registration Client ID
  // CLIENT_ID: '7df834b5-2073-409e-84ed-9109c97f41bb', // DUMMY CREDENTIALS from CGB
  CLIENT_ID : 'f62e1f79-aa9e-4eef-a6be-e6b5d6399fe6',
  
  
  // TENANT_ID: '2901dfc5-00d3-4131-989a-90c3cc14c950', // DUMMY CREDENTIALS from CGB
  TENANT_ID: '20692ac2-912f-4425-ab78-a937c909f459',

  
  // Redirect URI (must match what's configured in Azure)
  REDIRECT_URI: 'expense://auth',




  // Scopes for Microsoft Graph API
  SCOPES: [
    'openid',
    'profile',
    'email',
    'User.Read',
    'offline_access'
  ],
  
  // Microsoft Graph API endpoints
  GRAPH_ENDPOINTS: {
    AUTHORIZATION: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    TOKEN: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    USER_PROFILE: 'https://graph.microsoft.com/v1.0/me',
  },
  
  // Additional configuration
  ADDITIONAL_PARAMS: {
    prompt: 'select_account',
  },
};

// Instructions for Azure App Registration Setup:
/*
1. Go to Azure Portal (https://portal.azure.com)
2. Navigate to "Azure Active Directory" > "App registrations"
3. Click "New registration"
4. Fill in the details:
   - Name: "Expense Manager App"
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Redirect URI: Platform "Mobile and desktop applications", URI "expense://auth"
5. After creation, note down the "Application (client) ID"
6. Go to "Authentication" and add the redirect URI: "expense://auth"
7. Go to "API permissions" and add Microsoft Graph permissions:
   - User.Read (Delegated)
   - email (Delegated)
   - openid (Delegated)
   - profile (Delegated)
   - offline_access (Delegated)
8. Grant admin consent if required
9. Replace YOUR_MICROSOFT_CLIENT_ID with your actual Client ID
*/
