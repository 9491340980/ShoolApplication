import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { CLASSES, Role } from '../../core/models';
import { SchoolService } from '../../core/school.service';
import { TPipe } from '../../core/translate.service';
import { ROLE_LABELS } from '../../layout/nav-config';

type CreatableRole = Exclude<Role, 'superadmin' | 'headmaster'>;

@Component({
  selector: 'app-users',
  imports: [FormsModule, TPipe],
  templateUrl: './users.component.html',
})
export class UsersComponent {
  auth = inject(AuthService);
  schoolSvc = inject(SchoolService);
  data = inject(DataService);

  classes = CLASSES;
  roleLabels = ROLE_LABELS;
  creatableRoles: CreatableRole[] = ['teacher', 'parent', 'student'];

  name = signal('');
  email = signal('');
  password = signal('');
  role = signal<CreatableRole>('teacher');
  classId = signal('');
  studentId = signal('');
  error = signal<string | null>(null);
  created = signal(false);
  busy = signal(false);

  needsClass = computed(() => this.role() === 'teacher' || this.role() === 'student');
  needsStudent = computed(() => this.role() === 'parent' || this.role() === 'student');

  async addUser() {
    if (!this.name().trim() || !this.email().trim() || !this.password()) return;
    this.busy.set(true);
    this.error.set(null);
    const err = await this.schoolSvc.createSchoolUser({
      name: this.name(),
      email: this.email(),
      password: this.password(),
      role: this.role(),
      classId: this.needsClass() ? this.classId() || undefined : undefined,
      studentId: this.needsStudent() ? this.studentId() || undefined : undefined,
    });
    this.busy.set(false);
    if (err) {
      this.error.set(err);
      return;
    }
    this.name.set('');
    this.email.set('');
    this.password.set('');
    this.created.set(true);
    setTimeout(() => this.created.set(false), 3500);
  }
}
