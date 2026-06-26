// Paste your Firebase web app config here (Firebase Console → Project settings → Your apps).
// While apiKey is empty the app runs in offline demo mode with seeded data — perfect for client demos.
export const environment = {
  appName: 'VidyaSetu',
  schoolName: 'ZP High School, Vijayawada',
  // Google accounts allowed to act as VidyaSetu super admin (you, the developer).
  superAdminEmails: ['claudesubuser@gmail.com', 'sandeepreddy1248@gmail.com'],
  firebase: {
    apiKey: 'AIzaSyAF0tOkHMGTDZYUxy2TpE9I9PPOd8PGNGA',
    // Must match the domain the app is served from (web.app), otherwise Google
    // sign-in redirects cross-domain and fails with "missing initial state".
    authDomain: 'vidyasetu-d0ee7.web.app',
    projectId: 'vidyasetu-d0ee7',
    storageBucket: 'vidyasetu-d0ee7.firebasestorage.app',
    messagingSenderId: '709702363399',
    appId: '1:709702363399:web:cc8fee1b0fe9eb49f6bda2',
  },
};

export const firebaseEnabled = () => !!environment.firebase.apiKey;
