import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { AttendanceStatus, CLASSES } from '../../core/models';
import { TPipe, TranslateService } from '../../core/translate.service';

@Component({
  selector: 'app-attendance',
  imports: [FormsModule, TPipe],
  templateUrl: './attendance.component.html',
})
export class AttendanceComponent {
  auth = inject(AuthService);
  data = inject(DataService);
  i18n = inject(TranslateService);

  classes = CLASSES;
  isStaff = computed(() => this.auth.role() === 'headmaster' || this.auth.role() === 'teacher');

  classId = signal(this.auth.user()?.classId ?? '8A');
  date = signal(new Date().toISOString().slice(0, 10));
  statuses = signal<Record<string, AttendanceStatus>>({});
  saved = signal(false);

  students = computed(() => this.data.studentsOf(this.classId()));

  presentCount = computed(() => Object.values(this.statuses()).filter((v) => v === 'present').length);
  absentCount = computed(() => Object.values(this.statuses()).filter((v) => v === 'absent').length);

  // Load existing attendance whenever class/date changes
  private loader = effect(() => {
    const doc = this.data.attendanceDoc(this.classId(), this.date());
    this.statuses.set(doc ? { ...doc.statuses } : {});
  });

  mark(studentId: string, status: AttendanceStatus) {
    this.statuses.update((s) => ({ ...s, [studentId]: status }));
    this.saved.set(false);
  }

  /** Real-world flow: mark everyone present in one tap, then flip the few absentees. */
  markAllPresent() {
    const all: Record<string, AttendanceStatus> = {};
    for (const s of this.students()) all[s.id] = 'present';
    this.statuses.set(all);
    this.saved.set(false);
  }

  save() {
    this.data.saveAttendance(this.classId(), this.date(), this.statuses());
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2500);
  }

  // ---- parent / student view ----
  myStudent = computed(() => {
    const sid = this.auth.user()?.studentId;
    return sid ? this.data.student(sid) : undefined;
  });
  presentDays = 142;
  absentDays = 21;
}
