import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { DataService } from './data.service';
import { ConfigRole, Role } from './models';
import { CONFIG_ROLES, DEFAULT_DISABLED_ROLES, DEFAULT_PERMS, corePaths } from '../layout/nav-config';

/**
 * Resolves which tabs a role may see, layering a school's saved overrides on top
 * of the built-in defaults (and always keeping the "core" tabs). Drives both the
 * sidebar and the route guard so a hidden tab can't be reached by deep-linking.
 */
@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private data = inject(DataService);
  private auth = inject(AuthService);

  private isConfigRole(role: Role | null): role is ConfigRole {
    return !!role && (CONFIG_ROLES as string[]).includes(role);
  }

  /** Module paths the super admin turned off for this school. */
  private disabledModules = computed(() => new Set(this.data.permissions()?.disabledModules ?? []));
  /**
   * Roles turned off for this school. When the school has no config yet, parent
   * & student start off by default (the super admin opts them in).
   */
  disabledRoles = computed(() => new Set<Role>(this.data.permissions()?.disabledRoles ?? DEFAULT_DISABLED_ROLES));

  /** Is this module switched on for the school? (core modules can't be turned off.) */
  moduleEnabled(path: string): boolean {
    if (corePaths('headmaster').includes(path)) return true;
    return !this.disabledModules().has(path);
  }
  /** Is this role allowed to sign in / exist for the school? */
  roleEnabled(role: Role): boolean {
    return role === 'headmaster' || role === 'superadmin' || !this.disabledRoles().has(role);
  }

  /** Roles the signed-in user effectively holds (held roles minus any the school disabled). */
  readonly effectiveRoles = computed<Role[]>(() => this.auth.roles().filter((r) => this.roleEnabled(r)));

  /** Allowed feature paths for a role in the *current* school. */
  allowedFor(role: ConfigRole): Set<string> {
    const override = this.data.permissions()?.roles?.[role];
    const base = override ?? DEFAULT_PERMS[role] ?? [];
    return new Set([...base, ...corePaths(role)]);
  }

  /**
   * Allowed paths for the signed-in user: the *union* across every role they
   * hold (so a teacher who is also the accountant sees both sets of tabs).
   * Super admin → null (unrestricted).
   */
  readonly allowed = computed<Set<string> | null>(() => {
    const roles = this.effectiveRoles();
    if (roles.includes('superadmin')) return null;
    const union = new Set<string>();
    for (const r of roles) if (this.isConfigRole(r)) for (const p of this.allowedFor(r)) if (this.moduleEnabled(p)) union.add(p);
    return union;
  });

  /** Can the signed-in user open this tab/path? */
  can(path: string): boolean {
    const set = this.allowed();
    return set === null || set.has(path);
  }

  /** Resolve once permissions are loaded (so the route guard doesn't fall back to defaults on a cold deep-link). */
  async ready(): Promise<void> {
    const role = this.auth.role();
    if (role === 'superadmin' || !this.isConfigRole(role) || this.data.permsReady()) return;
    await new Promise<void>((resolve) => {
      const start = Date.now();
      const tick = () => (this.data.permsReady() || Date.now() - start > 2500 ? resolve() : setTimeout(tick, 50));
      tick();
    });
  }
}
