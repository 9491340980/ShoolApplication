import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { PermissionsService } from './permissions.service';
import { Role } from './models';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.user() ? true : inject(Router).createUrlTree(['/login']);
};

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const allowed = route.data['roles'] as Role[] | undefined;
  const role = auth.role();
  if (!allowed || (role && allowed.includes(role))) return true;
  return inject(Router).createUrlTree(['/dashboard']);
};

/**
 * Enforces the per-school tab permissions configured by the super admin / head
 * master: a tab hidden for the user's role can't be opened by deep-linking.
 */
export const permGuard: CanActivateChildFn = async (route: ActivatedRouteSnapshot) => {
  const perms = inject(PermissionsService);
  const router = inject(Router);
  await perms.ready();
  const path = '/' + (route.routeConfig?.path ?? '');
  return perms.can(path) ? true : router.createUrlTree(['/dashboard']);
};
