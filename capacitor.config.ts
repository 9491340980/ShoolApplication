import type { CapacitorConfig } from '@capacitor/cli';

/**
 * VidyaSetu Android app (Capacitor wrapper around the existing Angular PWA).
 *
 * The app loads the live hosted site, so:
 *  - content updates instantly on every `firebase deploy` (no new APK needed),
 *  - Firebase Auth (email/password + Google) works against the authorized
 *    Firebase Hosting domain.
 * To ship a fully offline/bundled build instead, remove the `server` block and
 * run `npm run build` + `npx cap sync` so the app serves `webDir` locally.
 */
const config: CapacitorConfig = {
  appId: 'com.vidyasetu.app',
  appName: 'VidyaSetu',
  webDir: 'dist/vidyasetu/browser',
  server: {
    url: 'https://vidyasetu-d0ee7.web.app',
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#1a56db',
  },
  plugins: {
    FirebaseAuthentication: {
      // We sign into the Firebase JS SDK ourselves (so Firestore/@angular/fire
      // stay authenticated); the plugin just returns the Google credential.
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
