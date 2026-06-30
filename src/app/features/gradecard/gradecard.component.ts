import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { SchoolService } from '../../core/school.service';
import { Student } from '../../core/models';
import { buildExportName } from '../../core/export';
import { downloadElementPdf } from '../../core/report-pdf';
import { TPipe } from '../../core/translate.service';

@Component({
  selector: 'app-gradecard',
  imports: [FormsModule, TPipe],
  templateUrl: './gradecard.component.html',
})
export class GradeCardComponent {
  private data = inject(DataService);
  private schoolSvc = inject(SchoolService);
  private auth = inject(AuthService);

  schoolName = computed(() => this.schoolSvc.currentSchool()?.name ?? environment.schoolName);
  schoolAddress = computed(() => this.schoolSvc.currentSchool()?.address || '');
  logo = computed(() => this.schoolSvc.currentSchool()?.logo || '');

  classes = computed(() => {
    if (this.auth.role() === 'teacher') return this.data.classesForTeacher(this.auth.user()!.id);
    return this.data.schoolClasses();
  });
  classId = signal('');
  private classGuard = effect(() => {
    const allowed = this.classes();
    if (allowed.length && !allowed.includes(this.classId())) this.classId.set(allowed[0]);
  });

  exams = computed(() => this.data.schoolExams());
  /** Subject columns (split groups collapsed to one). */
  units = computed<string[]>(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of this.data.subjects()) {
      const u = s.group ?? s.name;
      if (!seen.has(u)) {
        seen.add(u);
        out.push(u);
      }
    }
    return out;
  });
  students = computed(() => this.data.studentsOf(this.classId()));

  examMax(examId: string): number {
    return this.exams().find((e) => e.id === examId)?.maxMarks ?? 100;
  }

  /** One student's total/max/% for one exam. */
  examOf(studentId: string, examId: string): { total: number; max: number; pct: number; has: boolean } {
    const marks = this.data.studentMarks(studentId, examId);
    const total = marks.reduce((a, m) => a + m.score, 0);
    const max = marks.reduce((a, m) => a + m.max, 0);
    return { total, max, pct: max ? Math.round((total / max) * 1000) / 10 : 0, has: marks.length > 0 };
  }
  /** Overall across every exam (consolidated). */
  overall(studentId: string): { total: number; max: number; pct: number } {
    let total = 0;
    let max = 0;
    for (const e of this.exams()) {
      const x = this.examOf(studentId, e.id);
      total += x.total;
      max += x.max;
    }
    return { total, max, pct: max ? Math.round((total / max) * 1000) / 10 : 0 };
  }
  /** A single subject's mark in a given exam. */
  cell(studentId: string, examId: string, unit: string): number | undefined {
    return this.data.studentMarks(studentId, examId).find((m) => m.subject === unit)?.score;
  }
  subjectTotal(studentId: string, unit: string): number {
    return this.exams().reduce((a, e) => a + (this.cell(studentId, e.id, unit) ?? 0), 0);
  }
  grade(pct: number): string {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C+';
    if (pct >= 35) return 'C';
    return 'F';
  }
  pctColor(pct: number): string {
    if (pct >= 60) return 'text-success';
    if (pct >= 35) return 'text-amber-600';
    return 'text-danger';
  }

  // ---- printable card ----
  viewing = signal<Student | null>(null);
  open(s: Student) {
    this.viewing.set(s);
  }
  close() {
    this.viewing.set(null);
  }
  attPct(studentId: string): number | null {
    return this.data.studentAttendance(studentId).pct;
  }

  downloading = signal(false);
  async download() {
    const el = document.getElementById('grade-print');
    const s = this.viewing();
    if (!el || !s) return;
    this.downloading.set(true);
    const name = buildExportName({ module: 'ProgressCard', target: s.name }, this.schoolName());
    try {
      await downloadElementPdf(el, `${name}.pdf`);
    } finally {
      this.downloading.set(false);
    }
  }
}
