// Firebase Auth configuration for Google sign-in.
//
// HOW TO FILL THIS IN
// -------------------
// 1. Firebase console → Project settings → General → "Your apps" → Web app
//    → "Firebase SDK snippet" → "Config". Copy each value into FIREBASE_CONFIG.
//
// 2. Google Cloud console → APIs & Services → Credentials. You need THREE
//    OAuth 2.0 Client IDs (one per platform):
//      - Web client       → GOOGLE_OAUTH_CLIENT_IDS.web
//      - Android client   → GOOGLE_OAUTH_CLIENT_IDS.android
//      - iOS client       → GOOGLE_OAUTH_CLIENT_IDS.ios
//    They're all linked to the same Firebase project.
//
// 3. For Android, also drop `google-services.json` into `android/app/`.
//    For iOS, drop `GoogleService-Info.plist` into the iOS project.
//
// Until you replace every "YOUR_..." placeholder, `signInWithGoogle()` will
// throw a clear "Firebase not configured" error instead of silently failing.

export const FIREBASE_CONFIG = {
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

export const GOOGLE_OAUTH_CLIENT_IDS = {
  web: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
  android: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com',
  ios: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
};

function isPlaceholder(value) {
  return typeof value !== 'string' || value.startsWith('YOUR_') || value.includes('YOUR_PROJECT');
}

export function isFirebaseConfigured() {
  return !Object.values(FIREBASE_CONFIG).some(isPlaceholder);
}

export function isGoogleOAuthConfigured() {
  return !Object.values(GOOGLE_OAUTH_CLIENT_IDS).some(isPlaceholder);
}
