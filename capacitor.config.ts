import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hguard.elite',
  appName: 'HGUARD Elite',
  webDir: 'dist',
  android: {
    allowMixedContent: true, // Required for WebRTC & local media
    backgroundColor: '#000000',
    // Override User-Agent to remove '; wv' (WebView) flag so Google OAuth doesn't block it with 403 disallowed_useragent
    overrideUserAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.64 Mobile Safari/537.36',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
    },
  },
  server: {
    // Load live app from Firebase Hosting to enable OTA updates without reinstalling APK
    url: 'https://hguard-elite.web.app',
    cleartext: true,
    androidScheme: 'https',
  },
};

export default config;
