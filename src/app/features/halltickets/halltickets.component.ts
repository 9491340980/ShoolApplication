import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { DataService } from '../../core/data.service';
import { SUBJECTS, Student } from '../../core/models';
import { SchoolService } from '../../core/school.service';
import { TPipe } from '../../core/translate.service';

interface SchedRow {
  date: string;
  subject: string;
  time: string;
}
const LS_KEY = 'vidyasetu-hallticket';

/**
 * Exam Hall Ticket generator. The Head Master picks an exam, time, and a
 * date→subject schedule, then generates a printable hall ticket per student
 * (class-wise) — name & roll auto-filled, ready to print/save as PDF.
 */
@Component({
  selector: 'app-halltickets',
  imports: [FormsModule, TPipe],
  templateUrl: './halltickets.component.html',
})
export class HallTicketsComponent {
  private data = inject(DataService);
  private school = inject(SchoolService);

  schoolName = computed(() => this.school.currentSchool()?.name ?? environment.schoolName);
  logo = computed(() => this.school.currentSchool()?.logo || '');
  schoolAddress = computed(() => this.school.currentSchool()?.address || '');
  classes = computed(() => this.data.schoolClasses());
  exams = computed(() => this.data.schoolExams());
  subjectNames = SUBJECTS.map((s) => s.name);

  examTitle = signal('');
  subtitle = signal('');
  examTime = signal('9:00 AM to 11:30 AM'); // default time for new days
  classId = signal('');
  rows = signal<SchedRow[]>([{ date: '', subject: '', time: '' }]);
  generated = signal(false);

  constructor() {
    this.loadDraft();
    if (!this.classId() && this.classes().length) this.classId.set(this.classes()[0]);
  }

  addRow() {
    this.rows.update((r) => [...r, { date: '', subject: '', time: this.examTime() }]);
  }
  removeRow(i: number) {
    this.rows.update((r) => r.filter((_, k) => k !== i));
  }
  setDate(i: number, v: string) {
    this.rows.update((r) => r.map((x, k) => (k === i ? { ...x, date: v } : x)));
  }
  setSubject(i: number, v: string) {
    this.rows.update((r) => r.map((x, k) => (k === i ? { ...x, subject: v } : x)));
  }
  setTime(i: number, v: string) {
    this.rows.update((r) => r.map((x, k) => (k === i ? { ...x, time: v } : x)));
  }
  /** A day's time, falling back to the default exam time. */
  rowTime(r: SchedRow): string {
    return r.time?.trim() || this.examTime();
  }

  /** Rows with at least a date or subject filled. */
  validRows = computed(() => this.rows().filter((r) => r.date || r.subject || r.time));

  /** Students who get a ticket (single class, or all classes), sorted class → roll. */
  ticketStudents = computed<Student[]>(() => {
    const c = this.classId();
    const list = c === '__all__' ? [...this.data.students()] : this.data.studentsOf(c);
    return [...list].sort((a, b) => a.classId.localeCompare(b.classId) || (Number(a.roll) || 0) - (Number(b.roll) || 0));
  });

  canGenerate = computed(() => this.validRows().length > 0 && this.ticketStudents().length > 0);

  generate() {
    if (!this.canGenerate()) return;
    this.saveDraft();
    this.generated.set(true);
  }
  back() {
    this.generated.set(false);
  }
  print() {
    window.print();
  }

  /** yyyy-mm-dd → dd/mm/yyyy for display. */
  fmtDate(d: string): string {
    if (!d) return '—';
    const [y, m, dd] = d.split('-');
    return dd && m && y ? `${dd}/${m}/${y}` : d;
  }

  private saveDraft() {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ examTitle: this.examTitle(), subtitle: this.subtitle(), examTime: this.examTime(), rows: this.rows() }),
    );
  }
  private loadDraft() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (!s) return;
      this.examTitle.set(s.examTitle ?? this.examTitle());
      this.subtitle.set(s.subtitle ?? this.subtitle());
      this.examTime.set(s.examTime ?? this.examTime());
      if (Array.isArray(s.rows) && s.rows.length) this.rows.set(s.rows);
    } catch {
      /* ignore */
    }
  }
}
