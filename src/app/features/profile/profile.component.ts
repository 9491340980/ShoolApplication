import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
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

  schoolName = environment.schoolName;
  roleLabels = ROLE_LABELS;

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
