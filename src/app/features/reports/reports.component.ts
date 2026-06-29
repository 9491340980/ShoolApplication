import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { DataService } from '../../core/data.service';
import { ExportFormat, exportData } from '../../core/export';
import { SchoolService } from '../../core/school.service';
import { TPipe } from '../../core/translate.service';

@Component({
  selector: 'app-reports',
  imports: [FormsModule, TPipe],
  templateUrl: './reports.component.html',
})
export class ReportsComponent {
  data = inject(DataService);
  private schoolSvc = inject(SchoolService);

  private brand() {
    const s = this.schoolSvc.currentSchool();
    return { schoolName: s?.name ?? environment.schoolName, logo: s?.logo || undefined };
  }

  tab = signal<'fee' | 'attendance' | 'exam' | 'expenses'>('fee');
  exams = computed(() => this.data.schoolExams());
  examId = signal('quarterly');

  // ---- expenses report ----
  year = signal(new Date().toISOString().slice(0, 4));
  private yearBook = computed(() => this.data.expenses().filter((e) => e.date.startsWith(this.year())));
  private yearExpenses = computed(() => this.yearBook().filter((e) => e.type !== 'income'));
  private yearIncome = computed(() => this.yearBook().filter((e) => e.type === 'income'));
  expTotal = computed(() => this.yearExpenses().reduce((a, e) => a + e.amount, 0));
  /** Non-fee income recorded in the cash book. */
  otherIncome = computed(() => this.yearIncome().reduce((a, e) => a + e.amount, 0));
  expByCategory = computed(() => {
    const map = new Map<string, number>();
    for (const e of this.yearExpenses()) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    return [...map.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  });
  expByMonth = computed(() => {
    const map = new Map<string, number>();
    for (const e of this.yearExpenses()) {
      const m = e.date.slice(0, 7);
      map.set(m, (map.get(m) ?? 0) + e.amount);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, total]) => ({ month, total }));
  });
  netBalance = computed(() => this.feeTotals().collected + this.otherIncome() - this.expTotal());

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

  export(format: ExportFormat) {
    const t = this.tab();
    const brand = this.brand();
    if (t === 'fee') {
      exportData(format, 'Fee-Report', 'Fee Report', this.feeRows().map((r) => ({ Class: r.classId, Students: r.students, TotalFee: r.total, Collected: r.collected, Pending: r.pending })), brand);
    } else if (t === 'attendance') {
      exportData(format, 'Attendance-Report', 'Attendance Report', this.attRows().map((r) => ({ Class: r.classId, Students: r.students, Marked: r.marked, 'Avg%': r.avg ?? '', Below75: r.below })), brand);
    } else if (t === 'exam') {
      const exam = this.exams().find((e) => e.id === this.examId())?.label ?? this.examId();
      exportData(format, `Exam-Report-${exam}`, `Exam Report — ${exam}`, this.examRows().map((r) => ({ Class: r.classId, Appeared: r.appeared, 'Avg%': r.avg ?? '', 'Pass%': r.passPct, Topper: r.topper ? `${r.topper.name} (${r.topper.pct}%)` : '' })), brand);
    } else {
      exportData(format, `Expenses-${this.year()}`, `Expenses ${this.year()}`, this.expByCategory().map((r) => ({ Category: r.category, Total: r.total })), brand);
    }
  }
}
