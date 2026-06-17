import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { fileToSquareLogo } from '../../core/image';
import { SchoolService } from '../../core/school.service';
import { TPipe } from '../../core/translate.service';
import { ROLE_LABELS } from '../../layout/nav-config';

@Component({
  selector: 'app-profile',
  imports: [FormsModule, TPipe],
  templateUrl: './profile.component.html',
})
export class ProfileComponent {
  auth = inject(AuthService);
  data = inject(DataService);
  private schoolSvc = inject(SchoolService);

  schoolName = environment.schoolName;
  roleLabels = ROLE_LABELS;

  // ---- school logo (Head Master only) ----
  isHM = computed(() => this.auth.role() === 'headmaster');
  logo = computed(() => this.schoolSvc.currentSchool()?.logo || '');
  logoBusy = signal(false);
  logoError = signal<string | null>(null);

  async onLogoPick(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.logoBusy.set(true);
    this.logoError.set(null);
    try {
      const err = await this.schoolSvc.setOwnSchoolLogo(await fileToSquareLogo(file));
      if (err) this.logoError.set(err);
    } finally {
      this.logoBusy.set(false);
      input.value = '';
    }
  }
  async removeLogo() {
    this.logoError.set(null);
    const err = await this.schoolSvc.setOwnSchoolLogo(null);
    if (err) this.logoError.set(err);
  }

  currentPassword = signal('');
  newPassword = signal('');
  message = signal<string | null>(null);
  updated = signal(false);

  initial = computed(() => this.auth.user()?.name.charAt(0).toUpperCase() ?? '?');

  myStudent = computed(() => {
    const sid = this.auth.user()?.studentId;
    return sid ? this.data.student(sid) : undefined;
  });

  async updatePassword() {
    if (!this.newPassword().trim()) return;
    const err = await this.auth.changePassword(this.newPassword());
    this.message.set(err);
    if (!err) {
      this.updated.set(true);
      this.currentPassword.set('');
      this.newPassword.set('');
      setTimeout(() => this.updated.set(false), 2500);
    }
  }
}
