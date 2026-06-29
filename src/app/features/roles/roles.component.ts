import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { SchoolService } from '../../core/school.service';
import { ConfigRole, SchoolPermissions } from '../../core/models';
import { CONFIG_ROLES, DEFAULT_PERMS, FEATURES, Feature } from '../../layout/nav-config';
import { TKey } from '../../core/translations';
import { TPipe } from '../../core/translate.service';

@Component({
  selector: 'app-roles',
  imports: [FormsModule, TPipe],
  templateUrl: './roles.component.html',
})
export class RolesComponent {
  private auth = inject(AuthService);
  private data = inject(DataService);
  schoolSvc = inject(SchoolService);

  features = FEATURES;
  isSuper = computed(() => this.auth.role() === 'superadmin');

  /** Columns that can be edited: super admin → all roles; head master → their staff/parents/students. */
  editableRoles = computed<ConfigRole[]>(() => (this.isSuper() ? CONFIG_ROLES : (['teacher', 'accountant', 'parent', 'student'] as ConfigRole[])));

  /** Sections in display order. */
  sections = computed<TKey[]>(() => [...new Set(FEATURES.map((f) => f.section))]);
  featuresOf(section: TKey): Feature[] {
    return FEATURES.filter((f) => f.section === section);
  }

  /** The school being edited. */
  targetSchool = signal<string>('');
  private existing: SchoolPermissions['roles'] = {};
  draft = signal<Record<ConfigRole, string[]>>({ headmaster: [], teacher: [], accountant: [], parent: [], student: [] });
  saved = signal(false);
  loading = signal(false);

  constructor() {
    // Head master always edits their own school.
    effect(() => {
      if (!this.isSuper()) {
        const id = this.auth.user()?.schoolId ?? '';
        if (id && this.targetSchool() !== id) this.targetSchool.set(id);
      } else if (!this.targetSchool() && this.schoolSvc.schools().length) {
        this.targetSchool.set(this.schoolSvc.schools()[0].id);
      }
    });
    // Load the chosen school's permissions whenever it changes.
    effect(() => {
      const id = this.targetSchool();
      if (id) void this.load(id);
    });
  }

  private async load(schoolId: string) {
    this.loading.set(true);
    try {
      const perms = await this.data.fetchPermissions(schoolId);
      this.existing = perms?.roles ?? {};
    } catch {
      this.existing = {}; // no doc yet / not readable → start from defaults
    }
    const next: Record<ConfigRole, string[]> = { headmaster: [], teacher: [], accountant: [], parent: [], student: [] };
    for (const role of CONFIG_ROLES) next[role] = [...(this.existing[role] ?? DEFAULT_PERMS[role])];
    this.draft.set(next);
    this.loading.set(false);
  }

  isCore(f: Feature, role: ConfigRole): boolean {
    return !!f.core && f.roles.includes(role);
  }
  eligible(f: Feature, role: ConfigRole): boolean {
    return f.roles.includes(role);
  }
  isOn(role: ConfigRole, path: string): boolean {
    const f = FEATURES.find((x) => x.path === path);
    if (f && this.isCore(f, role)) return true;
    return this.draft()[role].includes(path);
  }
  toggle(f: Feature, role: ConfigRole) {
    if (this.isCore(f, role) || !this.eligible(f, role)) return;
    this.draft.update((d) => {
      const has = d[role].includes(f.path);
      return { ...d, [role]: has ? d[role].filter((p) => p !== f.path) : [...d[role], f.path] };
    });
  }
  countOn(role: ConfigRole): number {
    return FEATURES.filter((f) => this.eligible(f, role) && this.isOn(role, f.path)).length;
  }
  resetRole(role: ConfigRole) {
    this.draft.update((d) => ({ ...d, [role]: [...DEFAULT_PERMS[role]] }));
  }

  async save() {
    const id = this.targetSchool();
    if (!id) return;
    // Keep rows we don't edit (e.g. a head master must not wipe the head-master row).
    const roles: SchoolPermissions['roles'] = { ...this.existing };
    for (const role of this.editableRoles()) roles[role] = this.draft()[role];
    await this.data.savePermissions(id, roles);
    this.existing = roles;
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2500);
  }
}
