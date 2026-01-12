import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gastrogestor.app',
  appName: 'GastroGestor',
  webDir: 'dist',
  server: {
    url: 'https://1b22b8b3-f189-400c-9378-ff3dd025a939.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  android: {
    backgroundColor: '#0D773B',
    allowMixedContent: true,
  },
  ios: {
    backgroundColor: '#0D773B',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0D773B',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      iosSpinnerStyle: 'small',
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0D773B',
    },
  },
};

export default config;
