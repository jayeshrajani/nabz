"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously, type Auth } from "firebase/auth";

// Firebase web config is public by design; access is enforced server-side and by security rules.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const authEmulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;

let auth: Auth | undefined;

function clientAuth(): Auth {
  if (auth) return auth;
  const app = getApps().length ? getApp() : initializeApp(config);
  auth = getAuth(app);
  if (authEmulatorHost) connectAuthEmulator(auth, `http://${authEmulatorHost}`, { disableWarnings: true });
  return auth;
}

export async function getAnonymousIdToken(): Promise<string> {
  const a = clientAuth();
  await a.authStateReady();
  const user = a.currentUser ?? (await signInAnonymously(a)).user;
  return user.getIdToken();
}
