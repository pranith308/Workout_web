import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Local development against the Firebase Emulator Suite. Enabled only when
// VITE_FIREBASE_EMULATOR is set (see .env.development); production builds never
// set it, so this is a no-op outside local dev.
const useEmulators = import.meta.env.VITE_FIREBASE_EMULATOR === 'true';
const authEmulatorHost =
  import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const firestoreEmulatorHost =
  import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  );
}

function ensureApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured');
  }
  if (!app) {
    app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
  }
  return app;
}

export function getAuthInstance(): Auth {
  if (!authInstance) {
    authInstance = getAuth(ensureApp());
    if (useEmulators) {
      connectAuthEmulator(authInstance, `http://${authEmulatorHost}`, {
        disableWarnings: true,
      });
    }
  }
  return authInstance;
}

export function getDb(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(ensureApp());
    if (useEmulators) {
      const [host, port] = firestoreEmulatorHost.split(':');
      connectFirestoreEmulator(dbInstance, host, Number(port));
    }
  }
  return dbInstance;
}
