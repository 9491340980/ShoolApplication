// Test/demo environment: Firebase intentionally disabled so the app boots in
// fully offline demo mode (seeded localStorage data). Used by the e2e suite —
// deterministic, no network, never touches live data. Never deployed.
export const environment = {
  appName: 'VidyaSetu',
  schoolName: 'ZP High School, Vijayawada',
  superAdminEmails: ['claudesubuser@gmail.com', 'sandeepreddy1248@gmail.com'],
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },
};

export const firebaseEnabled = () => !!environment.firebase.apiKey;
