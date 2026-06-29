import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private swUpdate = inject(SwUpdate);

  constructor() {
    // Tag the document when running inside the Android/iOS wrapper so the CSS
    // can apply native-app chrome (safe-area clearance for the system bars).
    if (Capacitor.isNativePlatform()) document.documentElement.classList.add('native');


    // Auto-update: when a new deployed version is downloaded, activate it and
    // reload so users always get the latest (no manual cache clearing).
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.subscribe((evt) => {
        if (evt.type === 'VERSION_READY') {
          this.swUpdate.activateUpdate().then(() => document.location.reload());
        }
      });
      // Check again shortly after load and then hourly.
      this.swUpdate.checkForUpdate();
      setInterval(() => this.swUpdate.checkForUpdate(), 60 * 60 * 1000);
    }
  }
}
