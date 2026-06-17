import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AttendanceHistoryService } from '../../core/attendance-history.service';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { AppUser, Teacher } from '../../core/models';
import { SchoolService } from '../../core/school.service';
import { TPipe } from '../../core/translate.service';

@Component({
  selector: 'app-teachers',
  imports: [FormsModule, TPipe],
  templateUrl: './teachers.component.html',
})
export class TeachersComponent {
  auth = inject(AuthService);
  data = inject(DataService);
  private schoolSvc = inject(SchoolService);
  private hist = inject(AttendanceHistoryService);

  /** Tabs: directory list vs. daily teacher attendance. */
  tab = signal<'list' | 'attendance'>('list');
  /** List display: compact list (default) or cards. */
  viewMode = signal<'list' | 'card'>('list');

  search = signal('');
  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.data.teachers().filter((t) => !q || t.name.toLowerCase().includes(q));
  });

  // ---- teacher attendance (today) ----
  teacherUsers = computed(() => this.schoolSvc.schoolUsers().filter((u) => u.role === 'teacher'));
  teachersPresent = computed(
    () => Object.values(this.data.teacherAttToday()).filter((v) => v === 'present').length,
  );
  async openTeacherHistory(t: AppUser) {
    this.hist.open(t.name, await this.data.teacherAttendanceMap(t.id));
  }

  showAdd = signal(false);
  editingId = signal<string | null>(null);
  newName = signal('');
  newSubjects = signal('');
  newClasses = signal('');
  newExp = signal<number | null>(null); // optional, user-entered (no auto value)
  newPhone = signal('');
  added = signal(false);

  startAdd() {
    this.editingId.set(null);
    this.newName.set('');
    this.newSubjects.set('');
    this.newClasses.set('');
    this.newExp.set(null);
    this.newPhone.set('');
    this.showAdd.set(!this.showAdd());
  }

  startEdit(t: Teacher) {
    this.editingId.set(t.id);
    this.newName.set(t.name);
    this.newSubjects.set(t.subjects.join(', '));
    this.newClasses.set(t.classes.join(', '));
    this.newExp.set(t.experienceYears || null);
    this.newPhone.set(t.phone);
    this.showAdd.set(true);
  }

  saveTeacher() {
    if (!this.newName().trim()) return;
    const data = {
      name: this.newName().trim(),
      subjects: this.newSubjects().split(',').map((s) => s.trim()).filter(Boolean),
      classes: this.newClasses().split(',').map((s) => s.trim()).filter(Boolean),
      experienceYears: Number(this.newExp()) || 0,
      phone: this.newPhone().trim(),
    };
    const id = this.editingId();
    if (id) this.data.updateTeacher(id, data);
    else this.data.addTeacher({ ...data, active: true });
    this.showAdd.set(false);
    this.editingId.set(null);
    this.added.set(true);
    setTimeout(() => this.added.set(false), 2500);
  }
}
