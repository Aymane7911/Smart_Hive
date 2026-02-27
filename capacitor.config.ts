import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nahalai.app',
  appName: 'NahalAI',
  webDir: 'public',
   server: {
    url: 'https://smart-hive-jpy315jh5-aymane7911s-projects.vercel.app', // 👈 replace with your actual URL
    cleartext: true,
    allowNavigation: ['smart-hive-jpy315jh5-aymane7911s-projects.vercel.app'],
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
