import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { SchoolService } from '../../core/school.service';
import { ConfigRole, Role, SchoolPermissions } from '../../core/models';
import { CONFIG_ROLES, DEFAULT_DISABLED_MODULES, DEFAULT_DISABLED_ROLES, DEFAULT_PERMS, FEATURES, Feature, ROLE_LABELS } from '../../layout/nav-config';
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
  roleLabels = ROLE_LABELS;
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
  private existingDoc: SchoolPermissions | null = null;
  draft = signal<Record<ConfigRole, string[]>>({ headmaster: [], teacher: [], accountant: [], parent: [], student: [] });
  saved = signal(false);
  loading = signal(false);

  // ---- super-admin: school-level module & role switches ----
  /** Modules a super admin can switch on/off for the whole school (non-core only). */
  toggleableModules = FEATURES.filter((f) => !f.core);
  /** Roles a super admin can allow/disallow for the school (the Head Master is always allowed). */
  toggleableRoles: Role[] = ['teacher', 'accountant', 'parent', 'student'];
  draftDisabledModules = signal<string[]>([]);
  draftDisabledRoles = signal<Role[]>([]);

  moduleOn(path: string): boolean {
    return !this.draftDisabledModules().includes(path);
  }
  toggleModule(path: string) {
    this.draftDisabledModules.update((d) => (d.includes(path) ? d.filter((p) => p !== path) : [...d, path]));
  }
  roleOn(role: Role): boolean {
    return !this.draftDisabledRoles().includes(role);
  }
  toggleRoleEnabled(role: Role) {
    this.draftDisabledRoles.update((d) => (d.includes(role) ? d.filter((r) => r !== role) : [...d, role]));
  }

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
      this.existingDoc = await this.data.fetchPermissions(schoolId);
    } catch {
      this.existingDoc = null; // no doc yet / not readable → start from defaults
    }
    const roles = this.existingDoc?.roles ?? {};
    const next: Record<ConfigRole, string[]> = { headmaster: [], teacher: [], accountant: [], parent: [], student: [] };
    for (const role of CONFIG_ROLES) next[role] = [...(roles[role] ?? DEFAULT_PERMS[role])];
    this.draft.set(next);
    this.draftDisabledModules.set([...(this.existingDoc?.disabledModules ?? DEFAULT_DISABLED_MODULES)]);
    // No config yet → parent & student start disabled by default.
    this.draftDisabledRoles.set([...(this.existingDoc?.disabledRoles ?? DEFAULT_DISABLED_ROLES)]);
    this.loading.set(false);
  }

  isCore(f: Feature, role: ConfigRole): boolean {
    // The Head Master always sees every tab they're eligible for, so show those
    // cells locked-on (their visibility is governed by the module switches).
    if (role === 'headmaster') return f.roles.includes('headmaster');
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
    const roles: SchoolPermissions['roles'] = { ...(this.existingDoc?.roles ?? {}) };
    for (const role of this.editableRoles()) roles[role] = this.draft()[role];
    // Only the super admin edits the school-level module/role switches; the HM preserves them.
    const disabledModules = this.isSuper() ? this.draftDisabledModules() : this.existingDoc?.disabledModules ?? DEFAULT_DISABLED_MODULES;
    const disabledRoles = this.isSuper() ? this.draftDisabledRoles() : this.existingDoc?.disabledRoles ?? DEFAULT_DISABLED_ROLES;
    await this.data.savePermissions(id, { roles, disabledModules, disabledRoles });
    this.existingDoc = { schoolId: id, roles, disabledModules, disabledRoles };
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2500);
  }
}
