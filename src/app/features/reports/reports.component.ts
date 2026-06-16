import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/data.service';
import { TPipe } from '../../core/translate.service';

@Component({
  selector: 'app-reports',
  imports: [FormsModule, TPipe],
  templateUrl: './reports.component.html',
})
export class ReportsComponent {
  data = inject(DataService);

  tab = signal<'fee' | 'attendance' | 'exam'>('fee');
  exams = computed(() => this.data.schoolExams());
  examId = signal('quarterly');

  private examGuard = effect(() => {
    const ids = this.exams().map((e) => e.id);
    if (ids.length && !ids.includes(this.examId())) this.examId.set(ids[0]);
  });

  private classesWithStudents = computed(() =>
    this.data.schoolClasses().filter((c) => this.data.studentsOf(c).length > 0),
  );

  // ---- fee report ----
  feeRows = computed(() =>
    this.classesWithStudents().map((classId) => {
      const studs = this.data.studentsOf(classId);
      let total = 0;
      let collected = 0;
      let paidStudents = 0;
      for (const s of studs) {
        const fees = this.data.feesOf(s.id);
        const sTotal = fees.reduce((a, f) => a + f.amount, 0);
        const sPaid = fees.filter((f) => f.status === 'paid').reduce((a, f) => a + f.amount, 0);
        total += sTotal;
        collected += sPaid;
        if (sTotal > 0 && sPaid >= sTotal) paidStudents++;
      }
      return { classId, students: studs.length, total, collected, pending: total - collected, paidStudents };
    }),
  );
  feeTotals = computed(() => ({
    total: this.feeRows().reduce((a, r) => a + r.total, 0),
    collected: this.feeRows().reduce((a, r) => a + r.collected, 0),
    pending: this.feeRows().reduce((a, r) => a + r.pending, 0),
  }));

  // ---- attendance report ----
  attRows = computed(() =>
    this.classesWithStudents().map((classId) => {
      const studs = this.data.studentsOf(classId);
      const pcts = studs.map((s) => this.data.studentAttendance(s.id).pct).filter((p): p is number => p !== null);
      const avg = pcts.length ? Math.round(pcts.reduce((a, p) => a + p, 0) / pcts.length) : null;
      const below = pcts.filter((p) => p < 75).length;
      return { classId, students: studs.length, marked: pcts.length, avg, below };
    }),
  );
  attOverall = computed(() => {
    const withData = this.attRows().filter((r) => r.avg !== null);
    if (!withData.length) return null;
    return Math.round(withData.reduce((a, r) => a + (r.avg ?? 0), 0) / withData.length);
  });

  // ---- exam report ----
  examRows = computed(() =>
    this.classesWithStudents().map((classId) => {
      const studs = this.data.studentsOf(classId);
      const results = studs
        .map((s) => {
          const marks = this.data.studentMarks(s.id, this.examId());
          const total = marks.reduce((a, m) => a + m.score, 0);
          const max = marks.reduce((a, m) => a + m.max, 0);
          return { name: s.name, pct: max ? Math.round((total / max) * 1000) / 10 : null };
        })
        .filter((r): r is { name: string; pct: number } => r.pct !== null);
      const avg = results.length ? Math.round((results.reduce((a, r) => a + r.pct, 0) / results.length) * 10) / 10 : null;
      const passed = results.filter((r) => r.pct >= 35).length;
      const topper = [...results].sort((a, b) => b.pct - a.pct)[0];
      return { classId, appeared: results.length, avg, passed, passPct: results.length ? Math.round((passed / results.length) * 100) : 0, topper };
    }),
  );
}
