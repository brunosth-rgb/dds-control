import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

const required = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;
export const missingFirebaseConfig = required.filter((key) => !config[key]);
export const firebaseConfigured = missingFirebaseConfig.length === 0;

let app: FirebaseApp | null = null;
export let auth: Auth | null = null;
export let db: Firestore | null = null;

if (firebaseConfigured) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  void setPersistence(auth, browserLocalPersistence).catch(() => undefined);
}

export function requireAuth(): Auth {
  if (!auth) throw new Error('Firebase não configurado. Confira as variáveis VITE_FIREBASE_* do projeto.');
  return auth;
}

export function requireDb(): Firestore {
  if (!db) throw new Error('Firebase não configurado. Confira as variáveis VITE_FIREBASE_* do projeto.');
  return db;
}

export function currentUser(): User {
  const user = requireAuth().currentUser;
  if (!user) throw new Error('Sessão encerrada. Entre novamente.');
  return user;
}

export function currentDisplayName(): string {
  const user = currentUser();
  return user.displayName || user.email || 'Operador';
}

export async function logout() {
  await signOut(requireAuth());
}
