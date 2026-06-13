import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CLASSES, School } from '../../core/models';
import { SchoolService } from '../../core/school.service';
import { TPipe } from '../../core/translate.service';

@Component({
  selector: 'app-admin',
  imports: [FormsModule, TPipe],
  templateUrl: './admin.component.html',
})
export class AdminComponent {
  schoolSvc = inject(SchoolService);

  classes = CLASSES;

  name = signal('');
  adminEmail = signal('');
  phone = signal('');
  address = signal('');
  error = signal<string | null>(null);
  created = signal(false);
  busy = signal(false);

  /** School whose class teachers the super admin is currently managing. */
  managing = signal<School | null>(null);

  activeCount = computed(() => this.schoolSvc.schools().filter((s) => s.active).length);

  manageClassTeachers(school: School) {
    this.managing.set(school);
    this.schoolSvc.openSchoolManagement(school.id);
  }

  closeManage() {
    this.managing.set(null);
    this.schoolSvc.closeSchoolManagement();
  }

  assign(schoolId: string, classId: string, teacherId: string) {
    if (!teacherId) {
      this.schoolSvc.clearClassTeacherFor(schoolId, classId);
      return;
    }
    const t = this.schoolSvc.mgmtTeachers().find((u) => u.id === teacherId);
    this.schoolSvc.assignClassTeacherFor(schoolId, classId, teacherId, t?.name ?? '');
  }

  async addSchool() {
    if (!this.name().trim() || !this.adminEmail().trim()) return;
    this.busy.set(true);
    this.error.set(null);
    const err = await this.schoolSvc.addSchool(this.name(), this.adminEmail(), this.phone(), this.address());
    this.busy.set(false);
    if (err) {
      this.error.set(err);
      return;
    }
    this.name.set('');
    this.adminEmail.set('');
    this.phone.set('');
    this.address.set('');
    this.created.set(true);
    setTimeout(() => this.created.set(false), 2500);
  }
}
