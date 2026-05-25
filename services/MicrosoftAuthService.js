import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MICROSOFT_AUTH_CONFIG } from '../config/microsoftAuth';

// Configure WebBrowser for better UX
WebBrowser.maybeCompleteAuthSession();

// Microsoft OAuth Configuration
const MICROSOFT_CLIENT_ID = MICROSOFT_AUTH_CONFIG.CLIENT_ID;
const MICROSOFT_TENANT_ID = MICROSOFT_AUTH_CONFIG.TENANT_ID;

// Determine if we should use Expo proxy redirect
// Use proxy ONLY in Expo Go; use native scheme everywhere else (dev client + release)
const IS_EXPO_GO = Constants.appOwnership === 'expo';

// In dev client (expo run:android/ios), appOwnership !== 'expo' even though __DEV__ is true.
// We want native scheme (expense://auth) there, so avoid coupling to __DEV__.
const USE_PROXY = IS_EXPO_GO;

// Construct redirect URI
// In development with proxy: must use https://auth.expo.io/@owner/slug for Azure
// makeRedirectUri with useProxy might return exp://, so we need to construct the proxy URL manually
// In production: use native scheme
let MICROSOFT_REDIRECT_URI;
if (USE_PROXY) {
  // Get owner and slug for Expo proxy URL
  const owner = Constants.expoConfig?.owner || 
                Constants.manifest?.owner || 
                'gourav-cgb';
  const slug = Constants.expoConfig?.slug || 
               Constants.manifest?.slug || 
               'expense';
  // Construct Expo proxy redirect URI that Azure expects
  MICROSOFT_REDIRECT_URI = `https://auth.expo.io/@${owner}/${slug}`;
} else {
  // Use native scheme for production builds
  MICROSOFT_REDIRECT_URI = AuthSession.makeRedirectUri({
    scheme: 'expense',
    path: 'auth',
    useProxy: false,
  });
}

// Log the redirect URI being used (for debugging)
if (__DEV__) {
  console.log('Microsoft Auth - Development mode (__DEV__):', __DEV__);
  console.log('Microsoft Auth - Expo Go:', IS_EXPO_GO);
  console.log('Microsoft Auth - Using proxy:', USE_PROXY);
  console.log('Microsoft Auth - Redirect URI:', MICROSOFT_REDIRECT_URI);
}

// Microsoft Graph API endpoints
const MICROSOFT_AUTHORIZATION_ENDPOINT = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`;
const MICROSOFT_TOKEN_ENDPOINT = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;
const MICROSOFT_GRAPH_ENDPOINT = MICROSOFT_AUTH_CONFIG.GRAPH_ENDPOINTS.USER_PROFILE;

// Scopes for Microsoft Graph API
const SCOPES = MICROSOFT_AUTH_CONFIG.SCOPES;

class MicrosoftAuthService {
  constructor() {
    this.isAuthenticated = false;
    this.user = null;
    this.accessToken = null;
    this.refreshToken = null;
  }

  /**
   * Get the Microsoft OAuth configuration
   */
  getAuthConfig() {
    return {
      clientId: MICROSOFT_CLIENT_ID,
      scopes: SCOPES,
      redirectUri: MICROSOFT_REDIRECT_URI,
      responseType: AuthSession.ResponseType.Code,
      extraParams: {
        prompt: 'select_account',
      },
      additionalParameters: {},
      customParameters: {
        tenant: MICROSOFT_TENANT_ID,
      },
    };
  }

  /**
   * Initiate Microsoft authentication flow using OAuth (browser-based)
   */
  async signIn() {
    try {
      console.log('Starting Microsoft authentication...');
      console.log('Using proxy:', USE_PROXY);
      console.log('Redirect URI:', MICROSOFT_REDIRECT_URI);
      
      // IMPORTANT: When using proxy, we must use the manually constructed proxy URL
      // (https://auth.expo.io/@owner/slug) because:
      // 1. Azure needs this exact URL registered
      // 2. Microsoft will redirect to this URL with the code
      // 3. Expo's proxy service will intercept it and route to the app
      // The key is that useProxy: true in promptAsync tells Expo to handle the proxy callback
      const authRequest = new AuthSession.AuthRequest({
        clientId: MICROSOFT_CLIENT_ID,
        scopes: SCOPES,
        redirectUri: MICROSOFT_REDIRECT_URI, // Use our manually constructed proxy URL
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
        extraParams: {
          prompt: 'select_account',
        },
        additionalParameters: {},
        customParameters: {
          tenant: MICROSOFT_TENANT_ID,
        },
      });

      const result = await authRequest.promptAsync(
        {
          authorizationEndpoint: MICROSOFT_AUTHORIZATION_ENDPOINT,
          showInRecents: true,
        },
        { useProxy: USE_PROXY }
      );

      console.log('Auth result type:', result.type);
      console.log('Auth result:', JSON.stringify(result, null, 2));

      if (result.type === 'success') {
        console.log('Authorization successful, exchanging code for token...');
        if (!result.params || !result.params.code) {
          console.error('Missing authorization code in result:', result);
          throw new Error('No authorization code received from Microsoft');
        }
        // Use the PKCE code verifier generated with this request
        const codeVerifier = authRequest.codeVerifier;
        const exchangeResult = await this.exchangeCodeForToken(result.params.code, codeVerifier);
        // Persist user profile and email for fast re-entry
        if (exchangeResult && exchangeResult.user) {
          await this.storeUserProfile(exchangeResult.user);
          console.log('Stored user profile and email locally after code exchange');
        }
        return exchangeResult;
      } else if (result.type === 'error') {
        console.error('Authentication error:', result.error);
        console.error('Error details:', result);
        const errorMessage = result.error?.message || result.error?.error_description || 'Unknown error';
        throw new Error(`Authentication failed: ${errorMessage}`);
      } else {
        console.log('Authentication cancelled by user or dismissed');
        console.log('Result:', result);
        return { success: false, cancelled: true };
      }
    } catch (error) {
      console.error('Microsoft authentication error:', error);
      throw error;
    }
  }

  /**
   * Authenticate using email and password with Microsoft (ROPC flow)
   * Note: This requires enabling "Public client flows" in Azure App Registration
   * and may not work for accounts with MFA or personal Microsoft accounts
   */
  async signInWithCredentials(email, password) {
    try {
      console.log('Starting Microsoft authentication with credentials...');

      // Microsoft ROPC endpoint
      const ropcEndpoint = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;

      const tokenRequest = {
        client_id: MICROSOFT_CLIENT_ID,
        grant_type: 'password',
        scope: SCOPES.join(' '),
        username: email,
        password: password,
      };

      const response = await fetch(ropcEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(tokenRequest).toString(),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('ROPC authentication error:', responseData);
        
        // Handle specific error messages
        if (responseData.error === 'invalid_grant') {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        } else if (responseData.error === 'interaction_required') {
          throw new Error('This account requires additional verification. Please use "Continue with Microsoft" button instead.');
        } else if (responseData.error === 'unauthorized_client') {
          throw new Error('Public client flows are not enabled in Azure App Registration. Please contact administrator.');
        }
        
        throw new Error(responseData.error_description || responseData.error || 'Authentication failed');
      }

      console.log('ROPC authentication successful');

      // Store tokens securely
      await this.storeTokens(responseData);

      // Get user profile
      const userProfile = await this.getUserProfile(responseData.access_token);
      // Persist user profile and email for fast re-entry
      await this.storeUserProfile(userProfile);
      console.log('Stored user profile and email locally after ROPC');
      
      this.isAuthenticated = true;
      this.user = userProfile;
      this.accessToken = responseData.access_token;
      this.refreshToken = responseData.refresh_token;

      return {
        success: true,
        user: userProfile,
        accessToken: responseData.access_token,
        refreshToken: responseData.refresh_token,
      };
    } catch (error) {
      console.error('ROPC authentication error:', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code, codeVerifier) {
    try {
      const tokenRequest = {
        client_id: MICROSOFT_CLIENT_ID,
        code: code,
        redirect_uri: MICROSOFT_REDIRECT_URI,
        grant_type: 'authorization_code',
        scope: SCOPES.join(' '),
        code_verifier: codeVerifier,
      };

      const response = await fetch(MICROSOFT_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(tokenRequest).toString(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Token exchange failed: ${errorData.error_description || 'Unknown error'}`);
      }

      const tokenData = await response.json();
      console.log('Token exchange successful');

      // Store tokens securely
      await this.storeTokens(tokenData);

      // Get user profile
      const userProfile = await this.getUserProfile(tokenData.access_token);
      console.log('Fetched user profile after token exchange:', userProfile);
      // Persist user profile and email for fast re-entry
      await this.storeUserProfile(userProfile);
      console.log('Stored user profile and email locally after token exchange');
      
      this.isAuthenticated = true;
      this.user = userProfile;
      this.accessToken = tokenData.access_token;
      this.refreshToken = tokenData.refresh_token;

      return {
        success: true,
        user: userProfile,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
      };
    } catch (error) {
      console.error('Token exchange error:', error);
      throw error;
    }
  }

  /**
   * Get user profile from Microsoft Graph API
   */
  async getUserProfile(accessToken) {
    try {
      const response = await fetch(MICROSOFT_GRAPH_ENDPOINT, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const userData = await response.json();
      console.log('User profile fetched successfully');
      console.log('User profile payload:', userData);

      return {
        id: userData.id,
        displayName: userData.displayName,
        givenName: userData.givenName,
        surname: userData.surname,
        mail: userData.mail || userData.userPrincipalName,
        userPrincipalName: userData.userPrincipalName,
        jobTitle: userData.jobTitle,
        officeLocation: userData.officeLocation,
        preferredLanguage: userData.preferredLanguage,
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }

  /**
   * Store authentication tokens securely
   */
  async storeTokens(tokenData) {
    try {
      await AsyncStorage.setItem('microsoft_access_token', tokenData.access_token);
      if (tokenData.refresh_token) {
        await AsyncStorage.setItem('microsoft_refresh_token', tokenData.refresh_token);
      }
      await AsyncStorage.setItem('microsoft_token_expires_at', 
        (Date.now() + (tokenData.expires_in * 1000)).toString()
      );
      console.log('Tokens stored successfully');
      console.log('Access token present:', !!tokenData.access_token);
      console.log('Refresh token present:', !!tokenData.refresh_token);
      console.log('Expires in (seconds):', tokenData.expires_in);
    } catch (error) {
      console.error('Error storing tokens:', error);
      throw error;
    }
  }

  /**
   * Store user profile and email for fast re-entry
   */
  async storeUserProfile(userProfile) {
    try {
      await AsyncStorage.setItem('microsoft_user_profile', JSON.stringify(userProfile));
      const email = userProfile.mail || userProfile.userPrincipalName || '';
      if (email) {
        await AsyncStorage.setItem('user_email', email);
      }
    } catch (error) {
      console.error('Error storing user profile/email:', error);
    }
  }

  /**
   * Load stored authentication data
   */
  async loadStoredAuth() {
    try {
      const accessToken = await AsyncStorage.getItem('microsoft_access_token');
      const refreshToken = await AsyncStorage.getItem('microsoft_refresh_token');
      const expiresAt = await AsyncStorage.getItem('microsoft_token_expires_at');
      const storedEmail = await AsyncStorage.getItem('user_email');
      const storedUserProfileJson = await AsyncStorage.getItem('microsoft_user_profile');

      if (accessToken && expiresAt) {
        const now = Date.now();
        const expirationTime = parseInt(expiresAt);

        if (now < expirationTime) {
          // Token is still valid
          this.accessToken = accessToken;
          this.refreshToken = refreshToken;
          this.isAuthenticated = true;
          
          // Prefer stored profile for faster load; refresh silently in background
          if (storedUserProfileJson) {
            try {
              this.user = JSON.parse(storedUserProfileJson);
              console.log('Loaded user profile from local storage');
            } catch (e) {
              this.user = await this.getUserProfile(accessToken);
            }
          } else {
            this.user = await this.getUserProfile(accessToken);
          }
          if (storedEmail) {
            console.log('Loaded stored email:', storedEmail);
          }
          return true;
        } else if (refreshToken) {
          // Token expired, try to refresh using stored refresh token
          this.refreshToken = refreshToken;
          return await this.refreshAccessToken();
        }
      }
      return false;
    } catch (error) {
      console.error('Error loading stored auth:', error);
      return false;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken() {
    try {
      if (!this.refreshToken) {
        console.warn('refreshAccessToken called without a refresh token; skipping refresh.');
        return false;
      }

      const refreshRequest = {
        client_id: MICROSOFT_CLIENT_ID,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
        scope: SCOPES.join(' '),
      };

      const response = await fetch(MICROSOFT_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(refreshRequest).toString(),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const tokenData = await response.json();
      await this.storeTokens(tokenData);

      this.accessToken = tokenData.access_token;
      if (tokenData.refresh_token) {
        this.refreshToken = tokenData.refresh_token;
      }

      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      await this.signOut();
      return false;
    }
  }

  /**
   * Sign out and clear stored data
   */
  async signOut() {
    console.log('🔓 [MICROSOFT AUTH SERVICE] signOut() called');
    try {
      console.log('🔓 [MICROSOFT AUTH SERVICE] Clearing AsyncStorage keys...');
      // Clear stored tokens
      await AsyncStorage.multiRemove([
        'microsoft_access_token',
        'microsoft_refresh_token',
        'microsoft_token_expires_at',
        'microsoft_user_profile',
        'user_email',
      ]);
      console.log('🔓 [MICROSOFT AUTH SERVICE] AsyncStorage cleared');

      console.log('🔓 [MICROSOFT AUTH SERVICE] Resetting service state...');
      // Reset state
      this.isAuthenticated = false;
      this.user = null;
      this.accessToken = null;
      this.refreshToken = null;

      console.log('🔓 [MICROSOFT AUTH SERVICE] Signed out successfully');
      return true;
    } catch (error) {
      console.error('🔓 [MICROSOFT AUTH SERVICE ERROR] Sign out error:', error);
      console.error('🔓 [MICROSOFT AUTH SERVICE ERROR] Error stack:', error.stack);
      return false;
    }
  }

  /**
   * Get current authentication state
   */
  getAuthState() {
    return {
      isAuthenticated: this.isAuthenticated,
      user: this.user,
      accessToken: this.accessToken,
    };
  }

  /**
   * Check if user is authenticated
   */
  isUserAuthenticated() {
    return this.isAuthenticated && this.user !== null;
  }

  /**
   * Get user's access token for API calls
   */
  getAccessToken() {
    return this.accessToken;
  }

  /**
   * Get user information
   */
  getUser() {
    return this.user;
  }
}

// Export singleton instance
export default new MicrosoftAuthService();
