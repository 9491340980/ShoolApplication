import { Component, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth.service';
import { PermissionsService } from '../core/permissions.service';
import { SchoolService } from '../core/school.service';
import { applyTheme } from '../core/themes';
import { TourService } from '../core/tour.service';
import { TPipe, TranslateService } from '../core/translate.service';
import { AttendanceHistoryComponent } from './attendance-history.component';
import { BulkSendBarComponent } from './bulk-send-bar.component';
import { IconComponent } from './icon.component';
import { NAV, NavItem, PAGE_TITLES, ROLE_LABELS } from './nav-config';
import { TKey } from '../core/translations';
import { ShareChooserComponent } from './share-chooser.component';
import { TourOverlayComponent } from './tour-overlay.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TPipe, IconComponent, BulkSendBarComponent, TourOverlayComponent, ShareChooserComponent, AttendanceHistoryComponent],
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  auth = inject(AuthService);
  i18n = inject(TranslateService);
  schoolSvc = inject(SchoolService);
  tour = inject(TourService);
  private perms = inject(PermissionsService);
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
    const roles = this.auth.roles();
    if (!roles.length) return [];
    if (roles.includes('superadmin')) return NAV.superadmin;
    const allowed = this.perms.allowed(); // union across roles (non-null for non-super)
    // Merge each role's sections, keeping section order and de-duping links by path.
    const order: TKey[] = [];
    const buckets = new Map<TKey, NavItem[]>();
    const seen = new Set<string>();
    for (const role of roles) {
      for (const section of NAV[role] ?? []) {
        if (!buckets.has(section.label)) {
          buckets.set(section.label, []);
          order.push(section.label);
        }
        const bucket = buckets.get(section.label)!;
        for (const item of section.items) {
          if (seen.has(item.path) || (allowed && !allowed.has(item.path))) continue;
          seen.add(item.path);
          bucket.push(item);
        }
      }
    }
    return order.map((label) => ({ label, items: buckets.get(label)! })).filter((s) => s.items.length);
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
