import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gastrogestor.app',
  appName: 'GastroGestor',
  webDir: 'dist',
  android: {
    backgroundColor: '#0D773B',
    allowMixedContent: true,
  },
  ios: {
    backgroundColor: '#FFFFFF',
    contentInset: 'always',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
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
