import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { TPipe } from '../../core/translate.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, TPipe],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  auth = inject(AuthService);
  data = inject(DataService);

  isStaff = computed(() => this.auth.role() === 'headmaster' || this.auth.role() === 'teacher');

  // ---- staff stats (live from the store) ----
  totalStudents = computed(() => this.data.students().length);
  totalTeachers = computed(() => this.data.teachers().length);
  todayAttendancePct = computed(() => {
    const rows = this.data.classAttendanceToday;
    return Math.round(rows.reduce((sum, r) => sum + r.pct, 0) / rows.length);
  });
  pendingFeeTotal = computed(() =>
    this.data.pendingFees().reduce((sum, f) => sum + f.amount, 0),
  );
  collectedTotal = computed(() =>
    this.data.fees().filter((f) => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0),
  );

  recentNotices = computed(() => this.data.notices().slice(0, 3));

  // ---- child / self stats ----
  myStudent = computed(() => {
    const sid = this.auth.user()?.studentId;
    return sid ? this.data.student(sid) : undefined;
  });
  myMarks = computed(() => {
    const sid = this.auth.user()?.studentId;
    return sid ? this.data.studentMarks(sid, 'quarterly') : [];
  });
  myAvg = computed(() => {
    const marks = this.myMarks();
    return marks.length ? Math.round(marks.reduce((s, m) => s + m.score, 0) / marks.length) : 0;
  });
  myRank = computed(() => {
    const stu = this.myStudent();
    if (!stu) return 0;
    const totals = this.data
      .studentsOf(stu.classId)
      .map((s) => ({
        id: s.id,
        total: this.data.studentMarks(s.id, 'quarterly').reduce((sum, m) => sum + m.score, 0),
      }))
      .sort((a, b) => b.total - a.total);
    return totals.findIndex((t) => t.id === stu.id) + 1;
  });
  myPendingFee = computed(() => {
    const sid = this.auth.user()?.studentId;
    return sid
      ? this.data.feesOf(sid).filter((f) => f.status === 'pending').reduce((s, f) => s + f.amount, 0)
      : 0;
  });

  barColor(pct: number): string {
    return pct >= 80 ? 'var(--color-success)' : pct >= 60 ? 'var(--color-primary)' : 'var(--color-danger)';
  }
}
