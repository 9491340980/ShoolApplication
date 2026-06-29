import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { Role } from '../../core/models';
import { PermissionsService } from '../../core/permissions.service';
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
  perms = inject(PermissionsService);

  /** Top tabs: user accounts vs. class & class-teacher setup. */
  tab = signal<'users' | 'classes'>('users');

  classes = computed(() => this.data.schoolClasses());
  roleLabels = ROLE_LABELS;
  private allCreatableRoles: CreatableRole[] = ['teacher', 'accountant', 'parent', 'student'];
  /** Only the roles the super admin has left enabled for this school. */
  creatableRoles = computed(() => this.allCreatableRoles.filter((r) => this.perms.roleEnabled(r)));

  // class management
  newClassName = signal('');
  addClass() {
    this.data.addClass(this.newClassName());
    this.newClassName.set('');
  }

  toggleUserDisabled(u: { id: string; disabled?: boolean }) {
    void this.schoolSvc.setUserDisabled(u.id, !u.disabled);
  }

  name = signal('');
  email = signal('');
  password = signal('');
  phone = signal('');
  role = signal<CreatableRole>('teacher');
  /** "This teacher also handles accounts" → grants the accountant role on top. */
  alsoAccountant = signal(false);
  classId = signal('');
  studentId = signal('');
  linkedTeacherId = signal('');
  error = signal<string | null>(null);
  created = signal(false);
  busy = signal(false);

  needsClass = computed(() => this.role() === 'teacher' || this.role() === 'student');
  needsStudent = computed(() => this.role() === 'parent' || this.role() === 'student');

  /** Keep the selected role valid if the school's enabled-roles change. */
  private roleGuard = effect(() => {
    const list = this.creatableRoles();
    if (list.length && !list.includes(this.role())) this.setRole(list[0]);
  });

  // ---- class teachers ----
  teacherUsers = computed(() => this.schoolSvc.schoolUsers().filter((u) => u.role === 'teacher'));

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
    if (role !== 'teacher') this.alsoAccountant.set(false);
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
      extraRoles: this.role() === 'teacher' && this.alsoAccountant() ? ['accountant'] : [],
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
    this.alsoAccountant.set(false);
    this.created.set(true);
    setTimeout(() => this.created.set(false), 3500);
  }
}
