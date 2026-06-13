import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-privacy',
  templateUrl: './privacy.component.html',
})
export class PrivacyComponent {
  private location = inject(Location);
  appName = environment.appName;
  updated = 'June 2026';
  // TODO: replace with your real support contact before going live.
  supportEmail = 'support@vidyasetu.app';
  supportPhone = '9000000001';

  back() {
    this.location.back();
  }
}
