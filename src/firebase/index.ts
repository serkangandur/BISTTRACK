'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

/**
 * Validates the Firebase configuration object.
 * Checks if the API key is present and not a placeholder.
 */
function isValidFirebaseConfig(config: any): boolean {
  return !!(config && config.apiKey && config.apiKey !== "buraya_yaz" && !config.apiKey.includes("undefined"));
}

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (!getApps().length) {
    let firebaseApp;
    
    if (!isValidFirebaseConfig(firebaseConfig)) {
      console.warn('Firebase configuration is missing or incomplete. Some features may not work. Please ensure NEXT_PUBLIC_FIREBASE_API_KEY and other variables are set in your environment.');
      
      // Use a minimal fallback to prevent the SDK from crashing immediately during initialization
      const fallbackConfig: FirebaseOptions = {
        apiKey: "placeholder-key",
        authDomain: "placeholder.firebaseapp.com",
        projectId: "placeholder-id",
        storageBucket: "placeholder.appspot.com",
        messagingSenderId: "000000000000",
        appId: "0:000000000000:web:0000000000000000000000"
      };
      firebaseApp = initializeApp(fallbackConfig);
    } else {
      try {
        firebaseApp = initializeApp(firebaseConfig);
      } catch (e) {
        console.error('Firebase initialization error:', e);
        // Fallback to avoid total app crash
        firebaseApp = initializeApp({ apiKey: "error" } as FirebaseOptions);
      }
    }

    return getSdks(firebaseApp);
  }

  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
