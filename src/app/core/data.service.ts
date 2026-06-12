import { Injectable, computed, inject, signal } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from '@angular/fire/firestore';
import { firebaseEnabled } from '../../environments/environment';
import {
  DEMO_ATTENDANCE,
  DEMO_CLASS_ATTENDANCE_TODAY,
  DEMO_FEES,
  DEMO_MARKS,
  DEMO_MONTHLY_ATTENDANCE,
  DEMO_NOTICES,
  DEMO_STUDENTS,
  DEMO_TEACHERS,
  DEMO_TIMETABLES,
  DEMO_USERS,
} from './demo-data';
import { AttendanceDoc, AttendanceStatus, FeeItem, MarksDoc, Notice, Student, Teacher, TimetableDoc } from './models';

const DB_KEY = 'vidyasetu-db-v1';

interface Db {
  students: Student[];
  teachers: Teacher[];
  notices: Notice[];
  fees: FeeItem[];
  attendance: AttendanceDoc[];
  marks: MarksDoc[];
  timetables: TimetableDoc[];
}

const EMPTY_DB: Db = {
  students: [],
  teachers: [],
  notices: [],
  fees: [],
  attendance: [],
  marks: [],
  timetables: [],
};

/**
 * Data store with two modes behind one API:
 * - Firebase connected → real-time Firestore listeners; mutations write to Firestore.
 * - No Firebase config → localStorage-persisted demo store (offline demos always work).
 *
 * The head-master demo account auto-seeds Firestore with demo data on first login
 * if the database is empty.
 */
@Injectable({ providedIn: 'root' })
export class DataService {
  private fs = firebaseEnabled() ? inject(Firestore) : null;
  private fbAuth = firebaseEnabled() ? inject(Auth) : null;

  private db = signal<Db>(this.fs ? EMPTY_DB : this.loadLocal());
  private listening = false;
  private seedAttempted = false;

  readonly students = computed(() => this.db().students);
  readonly teachers = computed(() => this.db().teachers);
  readonly notices = computed(() =>
    [...this.db().notices].sort((a, b) => b.date.localeCompare(a.date)),
  );
  readonly fees = computed(() => this.db().fees);

  readonly monthlyAttendance = DEMO_MONTHLY_ATTENDANCE;
  readonly classAttendanceToday = DEMO_CLASS_ATTENDANCE_TODAY;

  constructor() {
    if (this.fbAuth) {
      authState(this.fbAuth).subscribe((user) => {
        if (user) {
          this.startListeners();
        } else if (!this.listening) {
          // Not signed into Firebase (e.g. demo account missing) — show the
          // offline demo data instead of an empty app.
          this.db.set(this.loadLocal());
        }
      });
    }
  }

  // ---------- Firestore mode ----------

  private startListeners() {
    const fs = this.fs;
    if (this.listening || !fs) return;
    this.listening = true;

    const plain = ['students', 'teachers', 'notices', 'fees', 'attendance', 'marks'] as const;
    for (const name of plain) {
      onSnapshot(collection(fs, name), (snap) => {
        const rows = snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }));
        this.db.update((db) => ({ ...db, [name]: rows }) as Db);
        if (name === 'students' && snap.empty) void this.seedIfHeadmaster();
      });
    }

    // Firestore can't store nested arrays, so the grid travels as JSON.
    onSnapshot(collection(fs, 'timetables'), (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data();
        return {
          classId: d.id,
          periods: data['periods'],
          grid: JSON.parse(data['gridJson']),
        } as TimetableDoc;
      });
      this.db.update((db) => ({ ...db, timetables: rows }));
    });
  }

  private async seedIfHeadmaster() {
    const fs = this.fs;
    if (this.seedAttempted || !fs) return;
    if (this.fbAuth?.currentUser?.email !== DEMO_USERS.headmaster.email) return;
    this.seedAttempted = true;

    const batch = writeBatch(fs);
    for (const s of DEMO_STUDENTS) batch.set(doc(fs, 'students', s.id), s);
    for (const t of DEMO_TEACHERS) batch.set(doc(fs, 'teachers', t.id), t);
    for (const n of DEMO_NOTICES) batch.set(doc(fs, 'notices', n.id), n);
    for (const f of DEMO_FEES) batch.set(doc(fs, 'fees', f.id), f);
    for (const m of DEMO_MARKS) batch.set(doc(fs, 'marks', m.id), m);
    for (const tt of DEMO_TIMETABLES) {
      batch.set(doc(fs, 'timetables', tt.classId), {
        periods: tt.periods,
        gridJson: JSON.stringify(tt.grid),
      });
    }
    try {
      await batch.commit();
    } catch (e) {
      console.warn('Demo data seeding failed (check Firestore rules):', e);
    }
  }

  // ---------- local mode ----------

  private loadLocal(): Db {
    try {
      const saved = JSON.parse(localStorage.getItem(DB_KEY) || 'null');
      if (saved) return saved;
    } catch {
      /* corrupted store — reseed */
    }
    return {
      students: DEMO_STUDENTS,
      teachers: DEMO_TEACHERS,
      notices: DEMO_NOTICES,
      fees: DEMO_FEES,
      attendance: DEMO_ATTENDANCE,
      marks: DEMO_MARKS,
      timetables: DEMO_TIMETABLES,
    };
  }

  private commit(patch: Partial<Db>) {
    const next = { ...this.db(), ...patch };
    this.db.set(next);
    localStorage.setItem(DB_KEY, JSON.stringify(next));
  }

  /** Reset the offline demo store (no-op when Firestore is connected). */
  resetDemoData() {
    if (this.fs) return;
    localStorage.removeItem(DB_KEY);
    this.db.set(this.loadLocal());
  }

  // ---------- queries ----------

  studentsOf(classId: string): Student[] {
    return this.db().students.filter((s) => s.classId === classId);
  }

  student(id: string): Student | undefined {
    return this.db().students.find((s) => s.id === id);
  }

  attendanceDoc(classId: string, date: string): AttendanceDoc | undefined {
    return this.db().attendance.find((a) => a.id === `${classId}_${date}`);
  }

  marksDoc(classId: string, examId: string, subject: string): MarksDoc | undefined {
    return this.db().marks.find((m) => m.id === `${classId}_${examId}_${subject}`);
  }

  /** All subject scores of one student for an exam: [{subject, score}] */
  studentMarks(studentId: string, examId: string): { subject: string; score: number }[] {
    return this.db()
      .marks.filter((m) => m.examId === examId && m.scores[studentId] !== undefined)
      .map((m) => ({ subject: m.subject, score: m.scores[studentId] }));
  }

  feesOf(studentId: string): FeeItem[] {
    return this.db().fees.filter((f) => f.studentId === studentId);
  }

  pendingFees(): FeeItem[] {
    return this.db().fees.filter((f) => f.status === 'pending');
  }

  timetable(classId: string): TimetableDoc | undefined {
    return this.db().timetables.find((t) => t.classId === classId);
  }

  // ---------- mutations ----------

  saveAttendance(classId: string, date: string, statuses: Record<string, AttendanceStatus>) {
    const id = `${classId}_${date}`;
    if (this.fs) {
      void setDoc(doc(this.fs, 'attendance', id), { classId, date, statuses });
      return;
    }
    const rest = this.db().attendance.filter((a) => a.id !== id);
    this.commit({ attendance: [...rest, { id, classId, date, statuses }] });
  }

  saveMarks(classId: string, examId: string, subject: string, scores: Record<string, number>) {
    const id = `${classId}_${examId}_${subject}`;
    if (this.fs) {
      void setDoc(doc(this.fs, 'marks', id), { classId, examId, subject, scores });
      return;
    }
    const rest = this.db().marks.filter((m) => m.id !== id);
    this.commit({ marks: [...rest, { id, classId, examId, subject, scores }] });
  }

  markFeePaid(feeId: string) {
    if (this.fs) {
      void updateDoc(doc(this.fs, 'fees', feeId), { status: 'paid' });
      return;
    }
    this.commit({
      fees: this.db().fees.map((f) => (f.id === feeId ? { ...f, status: 'paid' as const } : f)),
    });
  }

  addNotice(notice: Omit<Notice, 'id'>) {
    const id = `n${Date.now()}`;
    if (this.fs) {
      void setDoc(doc(this.fs, 'notices', id), notice);
      return;
    }
    this.commit({ notices: [{ ...notice, id }, ...this.db().notices] });
  }
}
