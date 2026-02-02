import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gastrogestor.app',
  appName: 'GastroGestor',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    // Define o esquema como https para cumprir requisitos de segurança do Android
    androidScheme: 'https'
  },
  android: {
    backgroundColor: '#0D773B',
    // Desativar mixed content por segurança (exigência das lojas)
    allowMixedContent: false,
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
      showSpinner: true,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // 'Light' garante que os ícones da barra (hora, bateria) fiquem brancos sobre o fundo verde
      style: 'Light',
      backgroundColor: '#0D773B',
      overlaysWebView: false,
    },
  },
};

export default config;
