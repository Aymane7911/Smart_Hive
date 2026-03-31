import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nahalai.app',
  appName: 'NahalAI',
  webDir: 'out',
  server: {
    url: 'https://smart-hive-pi.vercel.app/',
    cleartext: true,
    allowNavigation: ['smart-hive-pi.vercel.app'],
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: false,
    },
    StatusBar: {
  overlaysWebView: false,
  style: 'DARK',
  backgroundColor: '#ffffff',
},
  },
};

export default config;