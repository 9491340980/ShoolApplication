import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { CLASSES, EXAMS, SUBJECTS } from '../../core/models';
import { TPipe } from '../../core/translate.service';

@Component({
  selector: 'app-marks',
  imports: [FormsModule, TPipe],
  templateUrl: './marks.component.html',
})
export class MarksComponent {
  auth = inject(AuthService);
  data = inject(DataService);

  classes = CLASSES;
  subjects = SUBJECTS;
  exams = EXAMS;

  isStaff = computed(() => this.auth.role() === 'headmaster' || this.auth.role() === 'teacher');

  // ---- staff entry ----
  classId = signal(this.auth.user()?.classId ?? '8A');
  examId = signal('quarterly');
  subject = signal('Telugu');
  scores = signal<Record<string, number>>({});
  saved = signal(false);

  students = computed(() => this.data.studentsOf(this.classId()));

  private loader = effect(() => {
    const doc = this.data.marksDoc(this.classId(), this.examId(), this.subject());
    this.scores.set(doc ? { ...doc.scores } : {});
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
