import {
  ApplicationConfig,
  EnvironmentProviders,
  Provider,
  provideBrowserGlobalErrorListeners,
  isDevMode,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { environment, firebaseEnabled } from '../environments/environment';
import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';

// Firebase providers are only registered once a real config is pasted into
// environment.ts — until then the app runs fully in offline demo mode.
const firebaseProviders: (Provider | EnvironmentProviders)[] = firebaseEnabled()
  ? [
      provideFirebaseApp(() => initializeApp(environment.firebase)),
      provideAuth(() => getAuth()),
      provideFirestore(() => getFirestore()),
    ]
  : [];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    ...firebaseProviders,
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
