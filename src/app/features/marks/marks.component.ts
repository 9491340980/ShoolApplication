import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { BulkSendService } from '../../core/bulk-send.service';
import { CLASSES, DEMO_SCHOOL_ID, EXAMS, Student } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { buildReportPdf, sharePdf } from '../../core/report-pdf';
import { SchoolService } from '../../core/school.service';
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
  private schoolSvc = inject(SchoolService);
  private notify = inject(NotifyService);
  bulk = inject(BulkSendService);

  exams = EXAMS;

  isStaff = computed(() => this.auth.role() === 'headmaster' || this.auth.role() === 'teacher');
  subjects = computed(() => this.data.subjects());

  /** Teacher sees only their assigned classes; Head Master sees all. */
  classes = computed(() => {
    if (this.auth.role() === 'teacher') return this.data.classesForTeacher(this.auth.user()!.id);
    return CLASSES;
  });

  // ---- staff entry (whole class × all subjects in one grid) ----
  viewMode = signal<'entry' | 'sheet'>('entry');
  classId = signal('');

  private classGuard = effect(() => {
    const allowed = this.classes();
    if (allowed.length && !allowed.includes(this.classId())) this.classId.set(allowed[0]);
  });
  examId = signal('quarterly');
  maxMarks = signal(100);
  /** studentId -> subject -> score */
  matrix = signal<Record<string, Record<string, number>>>({});
  saved = signal(false);

  showSubjects = signal(false);
  newSubject = signal('');

  students = computed(() => this.data.studentsOf(this.classId()));

  /** Seeded demo data keys scores by raw ids (s01); new data by full doc ids. */
  private rawId(id: string): string {
    const sid = this.auth.user()?.schoolId ?? DEMO_SCHOOL_ID;
    return id.startsWith(`${sid}_`) ? id.slice(sid.length + 1) : id;
  }

  /** Load every subject's saved marks for this class & exam into the grid. */
  private loader = effect(() => {
    const cls = this.classId();
    const exam = this.examId();
    const subs = this.subjects();
    const studs = this.students();
    const m: Record<string, Record<string, number>> = {};
    let loadedMax: number | undefined;
    for (const stu of studs) m[stu.id] = {};
    for (const sub of subs) {
      const docu = this.data.marksDoc(cls, exam, sub);
      if (!docu) continue;
      if (loadedMax === undefined) loadedMax = docu.maxMarks ?? 100;
      for (const stu of studs) {
        const v = docu.scores[stu.id] ?? docu.scores[this.rawId(stu.id)];
        if (v !== undefined) m[stu.id][sub] = v;
      }
    }
    this.matrix.set(m);
    if (loadedMax !== undefined) this.maxMarks.set(loadedMax);
  });

  cell(studentId: string, subject: string): number | undefined {
    return this.matrix()[studentId]?.[subject];
  }

  setCell(studentId: string, subject: string, value: string) {
    const max = this.maxMarks() || 100;
    const raw = value === '' ? NaN : Number(value);
    this.matrix.update((m) => {
      const row = { ...(m[studentId] ?? {}) };
      if (Number.isNaN(raw)) {
        delete row[subject];
      } else {
        row[subject] = Math.max(0, Math.min(max, raw));
      }
      return { ...m, [studentId]: row };
    });
    this.saved.set(false);
  }

  studentTotal(studentId: string): number {
    const row = this.matrix()[studentId] ?? {};
    return Object.values(row).reduce((sum, v) => sum + v, 0);
  }

  private studentFilled(studentId: string): number {
    return Object.keys(this.matrix()[studentId] ?? {}).length;
  }

  studentPct(studentId: string): number {
    const filled = this.studentFilled(studentId);
    if (!filled) return 0;
    const max = (this.maxMarks() || 100) * filled;
    return Math.round((this.studentTotal(studentId) / max) * 1000) / 10;
  }

  save() {
    const bySubject: Record<string, Record<string, number>> = {};
    const m = this.matrix();
    for (const sub of this.subjects()) {
      const scores: Record<string, number> = {};
      for (const stu of this.students()) {
        const v = m[stu.id]?.[sub];
        if (v !== undefined && !Number.isNaN(v)) scores[stu.id] = v;
      }
      bySubject[sub] = scores;
    }
    this.data.saveMarksMatrix(this.classId(), this.examId(), this.maxMarks() || 100, bySubject);
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2500);
  }

  addSubject() {
    this.data.addSubject(this.newSubject());
    this.newSubject.set('');
  }

  grade(score: number | undefined, max = 100): string {
    if (score === undefined) return '—';
    const pct = (score / max) * 100;
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C+';
    if (pct >= 35) return 'C';
    return 'F';
  }

  /** Result sheet: every student × every subject for the selected class & exam. */
  sheet = computed<SheetRow[]>(() => {
    const subjects = this.subjects();
    const rows = this.students().map((student) => {
      const marks = this.data.studentMarks(student.id, this.examId());
      const bySubject = new Map(marks.map((m) => [m.subject, m.score]));
      const scores = subjects.map((sub) => bySubject.get(sub));
      const total = marks.reduce((sum, m) => sum + m.score, 0);
      const maxTotal = marks.reduce((sum, m) => sum + m.max, 0);
      const pct = maxTotal ? Math.round((total / maxTotal) * 1000) / 10 : 0;
      return { student, scores, total, pct, rank: 0 };
    });
    const order = [...rows].sort((a, b) => b.total - a.total);
    rows.forEach((r) => (r.rank = order.indexOf(r) + 1));
    return rows;
  });

  // ---- report card (printable / save as PDF) ----
  reportStudent = signal<Student | null>(null);
  reportExamId = signal('quarterly');

  schoolName = computed(() => this.schoolSvc.currentSchool()?.name ?? environment.schoolName);

  openReport(student: Student, examId: string) {
    this.reportExamId.set(examId);
    this.reportStudent.set(student);
  }
  closeReport() {
    this.reportStudent.set(null);
  }
  printReport() {
    window.print();
  }

  /** Build the full report-card data for any student & exam. */
  reportInfoFor(s: Student, exam: string) {
    const marks = this.data.studentMarks(s.id, exam);
    const total = marks.reduce((a, m) => a + m.score, 0);
    const maxTotal = marks.reduce((a, m) => a + m.max, 0);
    const pct = maxTotal ? Math.round((total / maxTotal) * 1000) / 10 : 0;
    const att = this.data.studentAttendance(s.id);
    const ranked = this.data
      .studentsOf(s.classId)
      .map((st) => ({ id: st.id, total: this.data.studentMarks(st.id, exam).reduce((a, m) => a + m.score, 0) }))
      .sort((a, b) => b.total - a.total);
    return {
      student: s,
      marks,
      total,
      maxTotal,
      pct,
      att,
      rank: ranked.findIndex((t) => t.id === s.id) + 1,
      classSize: ranked.length,
      examLabel: EXAMS.find((e) => e.id === exam)?.label ?? exam,
      pass: pct >= 35,
    };
  }

  reportData = computed(() => {
    const s = this.reportStudent();
    return s ? this.reportInfoFor(s, this.reportExamId()) : null;
  });

  private reportText(s: Student, exam: string): string {
    const r = this.reportInfoFor(s, exam);
    return this.notify.reportMessage({
      name: s.name,
      classId: s.classId,
      roll: s.roll,
      examLabel: r.examLabel,
      marks: r.marks,
      total: r.total,
      maxTotal: r.maxTotal,
      pct: r.pct,
      rank: r.rank,
      classSize: r.classSize,
      attPct: r.att.pct,
      pass: r.pass,
    });
  }

  /** Send one student's report card to the parent over WhatsApp (opens chat). */
  sendReportWa(s: Student, exam: string) {
    window.open(this.notify.whatsappLink(s.parentPhone, this.reportText(s, exam)), '_blank');
  }

  /** Generate the real PDF and share it via the phone's share sheet (WhatsApp etc.). */
  async sendReportPdf(s: Student, exam: string) {
    const r = this.reportInfoFor(s, exam);
    const doc = buildReportPdf({
      schoolName: this.schoolName(),
      name: s.name,
      classId: s.classId,
      roll: s.roll,
      admissionNo: s.admissionNo,
      fatherName: s.fatherName,
      examLabel: r.examLabel,
      marks: r.marks,
      total: r.total,
      maxTotal: r.maxTotal,
      pct: r.pct,
      rank: r.rank,
      classSize: r.classSize,
      attPct: r.att.pct,
      pass: r.pass,
    });
    await sharePdf(doc, `ReportCard-${s.name.replace(/\s+/g, '_')}.pdf`, this.reportText(s, exam));
  }

  /** SMS text fallback for parents without WhatsApp. */
  smsReportLink(s: Student, exam: string): string {
    return this.notify.smsLink(s.parentPhone, this.reportText(s, exam));
  }

  /** Guided bulk send of report cards for everyone in the selected class who has marks. */
  sendAllReports() {
    const exam = this.examId();
    const items = this.students()
      .filter((s) => this.data.studentMarks(s.id, exam).length > 0)
      .map((s) => ({ name: s.name, link: this.notify.whatsappLink(s.parentPhone, this.reportText(s, exam)) }));
    this.bulk.start(items);
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
  myMax = computed(() => this.myMarks().reduce((s, m) => s + m.max, 0));
  myPct = computed(() => (this.myMax() ? Math.round((this.myTotal() / this.myMax()) * 1000) / 10 : 0));
  best = computed(() => [...this.myMarks()].sort((a, b) => b.score / b.max - a.score / a.max)[0]);
  worst = computed(() => [...this.myMarks()].sort((a, b) => a.score / a.max - b.score / b.max)[0]);
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

  barColor(pct: number): string {
    return pct >= 75 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-primary)' : 'var(--color-danger)';
  }
}
