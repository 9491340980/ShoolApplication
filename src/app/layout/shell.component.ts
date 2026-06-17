import { Component, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth.service';
import { SchoolService } from '../core/school.service';
import { applyTheme } from '../core/themes';
import { TourService } from '../core/tour.service';
import { TPipe, TranslateService } from '../core/translate.service';
import { BulkSendBarComponent } from './bulk-send-bar.component';
import { IconComponent } from './icon.component';
import { NAV, PAGE_TITLES, ROLE_LABELS } from './nav-config';
import { ShareChooserComponent } from './share-chooser.component';
import { TourOverlayComponent } from './tour-overlay.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TPipe, IconComponent, BulkSendBarComponent, TourOverlayComponent, ShareChooserComponent],
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  auth = inject(AuthService);
  i18n = inject(TranslateService);
  schoolSvc = inject(SchoolService);
  tour = inject(TourService);
  private router = inject(Router);

  /** White-label: the school's own name is the app name for its users. */
  schoolName = computed(() => {
    if (this.auth.role() === 'superadmin') return 'VidyaSetu — Admin';
    return this.schoolSvc.currentSchool()?.name ?? environment.schoolName;
  });
  /** The signed-in school's logo (shown in the sidebar header). */
  schoolLogo = computed(() => this.schoolSvc.currentSchool()?.logo || '');
  roleLabels = ROLE_LABELS;
  drawerOpen = signal(false);

  private url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  nav = computed(() => {
    const role = this.auth.role();
    return role ? NAV[role] : [];
  });

  /** First 5 nav items, flattened — shown as an app-style bottom bar on phones. */
  bottomNav = computed(() =>
    this.nav()
      .flatMap((section) => section.items)
      .slice(0, 5),
  );

  pageTitle = computed(() => PAGE_TITLES[this.url()] ?? 'dashboard');

  /** Apply the signed-in school's theme (super admin / no school → default). */
  private themeEffect = effect(() => applyTheme(this.schoolSvc.currentSchool()?.theme));

  today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  initial = computed(() => this.auth.user()?.name.charAt(0).toUpperCase() ?? '?');

  closeDrawer() {
    this.drawerOpen.set(false);
  }
}
