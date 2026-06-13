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
  phone = signal('');
  role = signal<CreatableRole>('teacher');
  classId = signal('');
  studentId = signal('');
  linkedTeacherId = signal('');
  error = signal<string | null>(null);
  created = signal(false);
  busy = signal(false);

  needsClass = computed(() => this.role() === 'teacher' || this.role() === 'student');
  needsStudent = computed(() => this.role() === 'parent' || this.role() === 'student');

  // ---- class teachers + teacher attendance ----
  teacherUsers = computed(() => this.schoolSvc.schoolUsers().filter((u) => u.role === 'teacher'));
  teachersPresent = computed(
    () => Object.values(this.data.teacherAttToday()).filter((v) => v === 'present').length,
  );

  assignTeacher(classId: string, teacherId: string) {
    if (!teacherId) {
      this.data.clearClassTeacher(classId);
      return;
    }
    const t = this.teacherUsers().find((u) => u.id === teacherId);
    this.data.assignClassTeacher(classId, teacherId, t?.name ?? '');
  }

  setRole(role: CreatableRole) {
    this.role.set(role);
    this.linkedTeacherId.set('');
    this.studentId.set('');
  }

  /** Picking an existing teacher record fills the form — only email & password remain. */
  pickTeacher(teacherId: string) {
    this.linkedTeacherId.set(teacherId);
    const t = this.data.teachers().find((x) => x.id === teacherId);
    if (!t) return;
    this.name.set(t.name);
    this.phone.set(t.phone);
    this.classId.set(t.classes[0] ?? '');
  }

  /** Picking a student fills name/class (student login) or phone (parent login). */
  pickStudent(studentId: string) {
    this.studentId.set(studentId);
    const s = this.data.student(studentId);
    if (!s) return;
    if (this.role() === 'student') {
      this.name.set(s.name);
      this.classId.set(s.classId);
      this.phone.set(s.parentPhone);
    } else {
      // parent: name stays editable, phone comes from the student record
      this.phone.set(s.parentPhone);
      if (!this.name().trim()) this.name.set(`Parent of ${s.name}`);
    }
  }

  async addUser() {
    if (!this.name().trim() || !this.email().trim() || !this.password()) return;
    this.busy.set(true);
    this.error.set(null);
    const err = await this.schoolSvc.createSchoolUser({
      name: this.name(),
      email: this.email(),
      password: this.password(),
      role: this.role(),
      phone: this.phone() || undefined,
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
    this.phone.set('');
    this.linkedTeacherId.set('');
    this.studentId.set('');
    this.created.set(true);
    setTimeout(() => this.created.set(false), 3500);
  }
}
