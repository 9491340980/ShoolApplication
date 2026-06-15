import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { BulkSendService } from '../../core/bulk-send.service';
import { AttendanceStatus } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
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
  notify = inject(NotifyService);
  bulk = inject(BulkSendService);

  isStaff = computed(() => this.auth.role() === 'headmaster' || this.auth.role() === 'teacher');

  /** Head Master: all classes. Teacher: only the classes they are class teacher of. */
  classes = computed(() => {
    if (this.auth.role() === 'teacher') return this.data.classesForTeacher(this.auth.user()!.id);
    return this.data.schoolClasses();
  });
  /** A teacher with no class-teacher assignment cannot mark any attendance. */
  blocked = computed(() => this.auth.role() === 'teacher' && this.classes().length === 0);

  classId = signal('');
  date = signal(new Date().toISOString().slice(0, 10));
  statuses = signal<Record<string, AttendanceStatus>>({});
  saved = signal(false);

  // Keep the selected class valid for the current role's allowed classes.
  private classGuard = effect(() => {
    const allowed = this.classes();
    if (!allowed.length) return;
    if (!allowed.includes(this.classId())) this.classId.set(allowed[0]);
  });

  students = computed(() => this.data.studentsOf(this.classId()));

  presentCount = computed(() => Object.values(this.statuses()).filter((v) => v === 'present').length);
  absentCount = computed(() => Object.values(this.statuses()).filter((v) => v === 'absent').length);

  /** Absent students (with a parent phone) for sending alerts. */
  absentees = computed(() => this.students().filter((s) => this.statuses()[s.id] === 'absent'));

  waAbsence(s: { name: string; classId: string; parentPhone: string }): string {
    return this.notify.whatsappLink(s.parentPhone, this.notify.absenceMessage(s.name, s.classId, this.date()));
  }
  smsAbsence(s: { name: string; classId: string; parentPhone: string }): string {
    return this.notify.smsLink(s.parentPhone, this.notify.absenceMessage(s.name, s.classId, this.date()));
  }

  sendAllAbsence() {
    this.bulk.start(
      this.absentees().map((s) => ({ name: s.name, link: this.waAbsence(s) })),
    );
  }

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
  myAtt = computed(() => {
    const sid = this.auth.user()?.studentId;
    return sid
      ? this.data.studentAttendanceDetail(sid)
      : { present: 0, absent: 0, total: 0, pct: null, absentDates: [] as string[], byMonth: [] as { month: string; present: number; absent: number }[] };
  });

  monthLabel(ym: string): string {
    const [y, m] = ym.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[Number(m) - 1] ?? m} ${y}`;
  }
}
