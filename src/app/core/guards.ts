import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
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
