import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nahalai.app',
  appName: 'NahalAI',
  webDir: 'out',
   server: {
    url: 'https://smart-hive-pi.vercel.app/', // 👈 replace with your actual URL
    cleartext: true,
    allowNavigation: ['smart-hive-pi.vercel.app'],
  },
  
  
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: false,
    },
  },
};


export default config;
