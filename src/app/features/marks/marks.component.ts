import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { CLASSES, DEMO_SCHOOL_ID, EXAMS, Student } from '../../core/models';
import { TPipe } from '../../core/translate.service';

interface SheetRow {
  student: Student;
  scores: (number | undefined)[];
  total: number;
  pct: number;
  rank: number;
}

@Component({
  selector: 'app-marks',
  imports: [FormsModule, TPipe],
  templateUrl: './marks.component.html',
})
export class MarksComponent {
  auth = inject(AuthService);
  data = inject(DataService);

  classes = CLASSES;
  exams = EXAMS;

  isStaff = computed(() => this.auth.role() === 'headmaster' || this.auth.role() === 'teacher');
  subjects = computed(() => this.data.subjects());

  // ---- staff entry ----
  viewMode = signal<'entry' | 'sheet'>('entry');
  classId = signal(this.auth.user()?.classId ?? '8A');
  examId = signal('quarterly');
  subject = signal(this.data.subjects()[0]);
  scores = signal<Record<string, number>>({});
  saved = signal(false);

  showSubjects = signal(false);
  newSubject = signal('');

  students = computed(() => this.data.studentsOf(this.classId()));

  /** Seeded demo data keys scores by raw ids (s01); new data by full doc ids. */
  private rawId(id: string): string {
    const sid = this.auth.user()?.schoolId ?? DEMO_SCHOOL_ID;
    return id.startsWith(`${sid}_`) ? id.slice(sid.length + 1) : id;
  }

  private keepSubjectValid = effect(() => {
    if (!this.subjects().includes(this.subject())) this.subject.set(this.subjects()[0]);
  });

  private loader = effect(() => {
    const doc = this.data.marksDoc(this.classId(), this.examId(), this.subject());
    const normalized: Record<string, number> = {};
    if (doc) {
      for (const s of this.students()) {
        const v = doc.scores[s.id] ?? doc.scores[this.rawId(s.id)];
        if (v !== undefined) normalized[s.id] = v;
      }
    }
    this.scores.set(normalized);
  });

  setScore(studentId: string, value: string) {
    const n = Math.max(0, Math.min(100, Number(value) || 0));
    this.scores.update((s) => ({ ...s, [studentId]: n }));
    this.saved.set(false);
  }

  save() {
    this.data.saveMarks(this.classId(), this.examId(), this.subject(), this.scores());
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2500);
  }

  addSubject() {
    this.data.addSubject(this.newSubject());
    this.newSubject.set('');
  }

  scoreBadge(studentId: string): string {
    const score = this.scores()[studentId];
    if (score === undefined) return 'badge-blue';
    return score >= 75 ? 'badge-green' : score >= 50 ? 'badge-blue' : 'badge-red';
  }

  grade(score: number | undefined): string {
    if (score === undefined) return '—';
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B+';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C+';
    if (score >= 35) return 'C';
    return 'F';
  }

  /** Result sheet: every student × every subject for the selected class & exam. */
  sheet = computed<SheetRow[]>(() => {
    const subjects = this.subjects();
    const rows = this.students().map((student) => {
      const marks = this.data.studentMarks(student.id, this.examId());
      const bySubject = new Map(marks.map((m) => [m.subject, m.score]));
      const scores = subjects.map((sub) => bySubject.get(sub));
      const present = scores.filter((v): v is number => v !== undefined);
      const total = present.reduce((sum, v) => sum + v, 0);
      const pct = present.length ? Math.round((total / (present.length * 100)) * 1000) / 10 : 0;
      return { student, scores, total, pct, rank: 0 };
    });
    const order = [...rows].sort((a, b) => b.total - a.total);
    rows.forEach((r) => (r.rank = order.indexOf(r) + 1));
    return rows;
  });

  // ---- parent / student view ----
  viewExamId = signal('quarterly');
  myStudent = computed(() => {
    const sid = this.auth.user()?.studentId;
    return sid ? this.data.student(sid) : undefined;
  });
  myMarks = computed(() => {
    const sid = this.auth.user()?.studentId;
    return sid ? this.data.studentMarks(sid, this.viewExamId()) : [];
  });
  myTotal = computed(() => this.myMarks().reduce((s, m) => s + m.score, 0));
  myMax = computed(() => this.myMarks().length * 100);
  myPct = computed(() => (this.myMax() ? Math.round((this.myTotal() / this.myMax()) * 1000) / 10 : 0));
  best = computed(() => [...this.myMarks()].sort((a, b) => b.score - a.score)[0]);
  worst = computed(() => [...this.myMarks()].sort((a, b) => a.score - b.score)[0]);
  myRank = computed(() => {
    const stu = this.myStudent();
    if (!stu) return 0;
    const totals = this.data
      .studentsOf(stu.classId)
      .map((s) => ({
        id: s.id,
        total: this.data.studentMarks(s.id, this.viewExamId()).reduce((sum, m) => sum + m.score, 0),
      }))
      .sort((a, b) => b.total - a.total);
    return totals.findIndex((t) => t.id === stu.id) + 1;
  });
  classSize = computed(() => {
    const stu = this.myStudent();
    return stu ? this.data.studentsOf(stu.classId).length : 0;
  });

  barColor(score: number): string {
    return score >= 75 ? 'var(--color-success)' : score >= 50 ? 'var(--color-primary)' : 'var(--color-danger)';
  }
}
