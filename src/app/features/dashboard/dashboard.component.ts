import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { SchoolService } from '../../core/school.service';
import { TPipe } from '../../core/translate.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, TPipe],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  auth = inject(AuthService);
  data = inject(DataService);
  private schoolSvc = inject(SchoolService);

  school = computed(() => this.schoolSvc.currentSchool());

  constructor() {
    // The super admin's home is the schools panel.
    if (this.auth.role() === 'superadmin') {
      void inject(Router).navigateByUrl('/admin');
    }
  }

  isStaff = computed(() => this.auth.has('headmaster') || this.auth.has('teacher') || this.auth.has('accountant'));
  isHM = computed(() => this.auth.has('headmaster'));

  private today = new Date().toISOString().slice(0, 10);

  /** Teacher: only their assigned classes. Head Master: all. */
  private myClasses = computed(() =>
    this.auth.role() === 'teacher' ? this.data.classesForTeacher(this.auth.user()!.id) : null,
  );

  // ---- staff stats (live from the store) ----
  totalStudents = computed(() => {
    const mine = this.myClasses();
    const all = this.data.students();
    return mine ? all.filter((s) => mine.includes(s.classId)).length : all.length;
  });
  totalTeachers = computed(() => this.data.teachers().length);
  teachersPresent = computed(
    () => Object.values(this.data.teacherAttToday()).filter((v) => v === 'present').length,
  );

  /** Real per-class attendance for today, computed from saved attendance docs. */
  classRows = computed(() => {
    const mine = this.myClasses();
    let classIds = [...new Set(this.data.students().map((s) => s.classId))].sort();
    if (mine) classIds = classIds.filter((c) => mine.includes(c));
    return classIds.map((classId) => {
      const studs = this.data.studentsOf(classId);
      const doc = this.data.attendanceDoc(classId, this.today);
      const present = doc ? studs.filter((s) => doc.statuses[s.id] === 'present').length : 0;
      const marked = doc ? Object.keys(doc.statuses).length : 0;
      const pct = studs.length ? Math.round((present / studs.length) * 100) : 0;
      return { classId, total: studs.length, present, marked, pct };
    });
  });

  /** Overall today's attendance — null when nothing has been marked yet. */
  todayAttendancePct = computed<number | null>(() => {
    const marked = this.classRows().filter((r) => r.marked > 0);
    if (!marked.length) return null;
    const present = marked.reduce((s, r) => s + r.present, 0);
    const total = marked.reduce((s, r) => s + r.total, 0);
    return total ? Math.round((present / total) * 100) : 0;
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
  myAttendancePct = computed(() => {
    const sid = this.auth.user()?.studentId;
    return sid ? this.data.studentAttendance(sid).pct : null;
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
