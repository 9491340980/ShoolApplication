import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth.service';
import { SchoolService } from '../core/school.service';
import { TPipe, TranslateService } from '../core/translate.service';
import { IconComponent } from './icon.component';
import { NAV, PAGE_TITLES, ROLE_LABELS } from './nav-config';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TPipe, IconComponent],
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  auth = inject(AuthService);
  i18n = inject(TranslateService);
  schoolSvc = inject(SchoolService);
  private router = inject(Router);

  /** White-label: the school's own name is the app name for its users. */
  schoolName = computed(() => {
    if (this.auth.role() === 'superadmin') return 'VidyaSetu — Admin';
    return this.schoolSvc.currentSchool()?.name ?? environment.schoolName;
  });
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

  today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  initial = computed(() => this.auth.user()?.name.charAt(0).toUpperCase() ?? '?');

  closeDrawer() {
    this.drawerOpen.set(false);
  }
}
