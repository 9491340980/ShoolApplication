import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Role } from '../../core/models';
import { TPipe, TranslateService } from '../../core/translate.service';
import { ROLE_LABELS } from '../../layout/nav-config';

@Component({
  selector: 'app-login',
  imports: [FormsModule, TPipe, RouterLink],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  auth = inject(AuthService);
  i18n = inject(TranslateService);

  roles = (Object.entries(ROLE_LABELS) as [Role, { icon: string; label: any }][]).filter(
    ([role]) => role !== 'superadmin',
  ) as [Exclude<Role, 'superadmin'>, { icon: string; label: any }][];

  identifier = signal('');
  password = signal('');
  error = signal<string | null>(null);
  busy = signal(false);

  async submit() {
    this.busy.set(true);
    this.error.set(null);
    const err = await this.auth.loginWithPassword(this.identifier(), this.password());
    this.error.set(err);
    this.busy.set(false);
  }

  async google() {
    this.busy.set(true);
    this.error.set(null);
    const err = await this.auth.loginWithGoogle();
    this.error.set(err);
    this.busy.set(false);
  }
}
