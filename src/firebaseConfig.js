// Firebase Web App configuration for project: zuk-home-workout-app
// Note: Firebase client Web API keys are public identifiers by design; data access is enforced via Firestore Security Rules (firestore.rules).
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDHhr4CX-UNWK-bOwlQBrnW_7BtS4FKpbU',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'zuk-home-workout-app.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'zuk-home-workout-app',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'zuk-home-workout-app.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '174801001170',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:174801001170:web:989fa80c4b7de3b24bab0b',
};

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}
