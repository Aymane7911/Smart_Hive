import * as admin from 'firebase-admin';
import 'server-only'; // add this line

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    console.error('❌ [firebaseAdmin] Missing Firebase env vars. Push notifications will not work.');
  } else {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
    console.log('✅ [firebaseAdmin] Initialized');
    console.log('Firebase config:', {
  projectId:   process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  hasKey:      !!process.env.FIREBASE_PRIVATE_KEY,
});
  }
}

export default admin;