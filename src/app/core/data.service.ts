import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { firebaseEnabled } from '../../environments/environment';
import { AuthService } from './auth.service';
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
import {
  AttendanceDoc,
  AttendanceStatus,
  DEMO_SCHOOL_ID,
  FeeItem,
  MarksDoc,
  Notice,
  SUBJECTS,
  Student,
  Teacher,
  TimetableDoc,
} from './models';

const DB_KEY = 'vidyasetu-db-v1';

interface Db {
  students: Student[];
  teachers: Teacher[];
  notices: Notice[];
  fees: FeeItem[];
  attendance: AttendanceDoc[];
  marks: MarksDoc[];
  timetables: TimetableDoc[];
  /** School's own subject list (subject master); empty → default SUBJECTS. */
  subjectsList?: string[];
}

const EMPTY_DB: Db = {
  students: [],
  teachers: [],
  notices: [],
  fees: [],
  attendance: [],
  marks: [],
  timetables: [],
  subjectsList: [],
};

/**
 * Tenant-scoped data store with two modes behind one API:
 * - Firebase connected → real-time Firestore listeners filtered by the signed-in
 *   user's schoolId; every write is stamped with that schoolId.
 * - No Firebase config → localStorage-persisted demo store.
 *
 * The head-master demo account auto-seeds the demo school on first login.
 */
@Injectable({ providedIn: 'root' })
export class DataService {
  private fs = firebaseEnabled() ? inject(Firestore) : null;
  private fbAuth = firebaseEnabled() ? inject(Auth) : null;
  private auth = inject(AuthService);

  private db = signal<Db>(this.fs ? EMPTY_DB : this.loadLocal());
  private fbSignedIn = signal(false);
  private listeningFor: string | null = null;
  private unsubs: (() => void)[] = [];
  private seedAttempted = false;

  readonly students = computed(() => this.db().students);
  readonly teachers = computed(() => this.db().teachers);
  readonly notices = computed(() =>
    [...this.db().notices].sort((a, b) => b.date.localeCompare(a.date)),
  );
  readonly fees = computed(() => this.db().fees);
  /** Subject master — the school's own list, falling back to sensible defaults. */
  readonly subjects = computed(() => {
    const list = this.db().subjectsList;
    return list && list.length ? list : SUBJECTS;
  });

  readonly monthlyAttendance = DEMO_MONTHLY_ATTENDANCE;
  readonly classAttendanceToday = DEMO_CLASS_ATTENDANCE_TODAY;

  constructor() {
    if (this.fbAuth) {
      authState(this.fbAuth).subscribe((u) => this.fbSignedIn.set(!!u));
      effect(() => {
        const session = this.auth.user();
        if (this.fbSignedIn() && session && session.role !== 'superadmin') {
          this.startListeners(session.schoolId ?? DEMO_SCHOOL_ID);
        } else if (!this.fbSignedIn()) {
          // Not signed into Firebase (e.g. demo account missing) — show the
          // offline demo data instead of an empty app.
          this.stopListeners();
          this.db.set(this.loadLocal());
        }
      });
    }
  }

  /** Current tenant id for reads/writes. */
  private get sid(): string {
    return this.auth.user()?.schoolId ?? DEMO_SCHOOL_ID;
  }

  /** Firestore doc ids are prefixed with the school id so tenants never collide. */
  private docId(parts: string): string {
    return this.fs ? `${this.sid}_${parts}` : parts;
  }

  // ---------- Firestore mode ----------

  private startListeners(schoolId: string) {
    const fs = this.fs;
    if (!fs || this.listeningFor === schoolId) return;
    this.stopListeners();
    this.listeningFor = schoolId;
    this.db.set(EMPTY_DB);

    const plain = ['students', 'teachers', 'notices', 'fees', 'attendance', 'marks'] as const;
    for (const name of plain) {
      this.unsubs.push(
        onSnapshot(query(collection(fs, name), where('schoolId', '==', schoolId)), (snap) => {
          const rows = snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }));
          this.db.update((db) => ({ ...db, [name]: rows }) as Db);
          if (name === 'students' && snap.empty) void this.seedDemoSchool();
        }),
      );
    }

    this.unsubs.push(
      onSnapshot(query(collection(fs, 'subjects'), where('schoolId', '==', schoolId)), (snap) => {
        const names = snap.empty ? [] : ((snap.docs[0].data()['names'] as string[]) ?? []);
        this.db.update((db) => ({ ...db, subjectsList: names }));
      }),
    );

    // Firestore can't store nested arrays, so the grid travels as JSON.
    this.unsubs.push(
      onSnapshot(query(collection(fs, 'timetables'), where('schoolId', '==', schoolId)), (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data();
          return {
            schoolId: data['schoolId'],
            classId: data['classId'],
            periods: data['periods'],
            grid: JSON.parse(data['gridJson']),
          } as TimetableDoc;
        });
        this.db.update((db) => ({ ...db, timetables: rows }));
      }),
    );
  }

  private stopListeners() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.listeningFor = null;
  }

  /** Seeds the demo school once, only for the demo head master. */
  private async seedDemoSchool() {
    const fs = this.fs;
    if (this.seedAttempted || !fs) return;
    if (this.fbAuth?.currentUser?.email !== DEMO_USERS.headmaster.email) return;
    if (this.sid !== DEMO_SCHOOL_ID) return;
    this.seedAttempted = true;

    const sid = DEMO_SCHOOL_ID;
    const batch = writeBatch(fs);
    batch.set(doc(fs, 'schools', sid), {
      name: 'ZP High School, Vijayawada',
      adminEmail: DEMO_USERS.headmaster.email,
      phone: DEMO_USERS.headmaster.phone,
      address: 'Vijayawada, AP',
      active: true,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    for (const s of DEMO_STUDENTS) batch.set(doc(fs, 'students', `${sid}_${s.id}`), { ...s, schoolId: sid });
    for (const t of DEMO_TEACHERS) batch.set(doc(fs, 'teachers', `${sid}_${t.id}`), { ...t, schoolId: sid });
    for (const n of DEMO_NOTICES) batch.set(doc(fs, 'notices', `${sid}_${n.id}`), { ...n, schoolId: sid });
    for (const f of DEMO_FEES) batch.set(doc(fs, 'fees', `${sid}_${f.id}`), { ...f, schoolId: sid });
    for (const m of DEMO_MARKS) batch.set(doc(fs, 'marks', `${sid}_${m.id}`), { ...m, schoolId: sid });
    for (const tt of DEMO_TIMETABLES) {
      batch.set(doc(fs, 'timetables', `${sid}_${tt.classId}`), {
        schoolId: sid,
        classId: tt.classId,
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

  // ---------- queries (already school-scoped by the listeners) ----------

  studentsOf(classId: string): Student[] {
    return this.db().students.filter((s) => s.classId === classId);
  }

  student(id: string): Student | undefined {
    // Accept both raw ids (local/demo links like 's14') and prefixed Firestore ids.
    return this.db().students.find((s) => s.id === id || s.id === `${this.sid}_${id}`);
  }

  attendanceDoc(classId: string, date: string): AttendanceDoc | undefined {
    const id = this.docId(`${classId}_${date}`);
    return this.db().attendance.find((a) => a.id === id);
  }

  marksDoc(classId: string, examId: string, subject: string): MarksDoc | undefined {
    const id = this.docId(`${classId}_${examId}_${subject}`);
    return this.db().marks.find((m) => m.id === id);
  }

  /** All subject scores of one student for an exam: [{subject, score, max}] */
  studentMarks(studentId: string, examId: string): { subject: string; score: number; max: number }[] {
    const stu = this.student(studentId);
    const keys = stu ? [studentId, stu.id, stu.id.replace(`${this.sid}_`, '')] : [studentId];
    return this.db()
      .marks.filter((m) => m.examId === examId)
      .map((m) => {
        const key = keys.find((k) => m.scores[k] !== undefined);
        return key === undefined ? null : { subject: m.subject, score: m.scores[key], max: m.maxMarks ?? 100 };
      })
      .filter((x): x is { subject: string; score: number; max: number } => x !== null);
  }

  feesOf(studentId: string): FeeItem[] {
    const stu = this.student(studentId);
    const keys = stu ? [studentId, stu.id, stu.id.replace(`${this.sid}_`, '')] : [studentId];
    return this.db().fees.filter((f) => keys.includes(f.studentId));
  }

  pendingFees(): FeeItem[] {
    return this.db().fees.filter((f) => f.status === 'pending');
  }

  timetable(classId: string): TimetableDoc | undefined {
    return this.db().timetables.find((t) => t.classId === classId);
  }

  // ---------- mutations (stamped with schoolId) ----------

  saveAttendance(classId: string, date: string, statuses: Record<string, AttendanceStatus>) {
    const id = this.docId(`${classId}_${date}`);
    if (this.fs) {
      void setDoc(doc(this.fs, 'attendance', id), { schoolId: this.sid, classId, date, statuses });
      return;
    }
    const rest = this.db().attendance.filter((a) => a.id !== id);
    this.commit({ attendance: [...rest, { id, classId, date, statuses }] });
  }

  saveMarks(classId: string, examId: string, subject: string, scores: Record<string, number>, maxMarks = 100) {
    const id = this.docId(`${classId}_${examId}_${subject}`);
    if (this.fs) {
      void setDoc(doc(this.fs, 'marks', id), { schoolId: this.sid, classId, examId, subject, maxMarks, scores });
      return;
    }
    const rest = this.db().marks.filter((m) => m.id !== id);
    this.commit({ marks: [...rest, { id, classId, examId, subject, maxMarks, scores }] });
  }

  /** Save the whole class × all-subjects grid in one go (one doc per subject). */
  saveMarksMatrix(
    classId: string,
    examId: string,
    maxMarks: number,
    bySubject: Record<string, Record<string, number>>,
  ) {
    const subjects = Object.keys(bySubject);
    if (this.fs) {
      const batch = writeBatch(this.fs);
      for (const subject of subjects) {
        const id = this.docId(`${classId}_${examId}_${subject}`);
        batch.set(doc(this.fs, 'marks', id), {
          schoolId: this.sid,
          classId,
          examId,
          subject,
          maxMarks,
          scores: bySubject[subject],
        });
      }
      void batch.commit();
      return;
    }
    let marks = this.db().marks;
    for (const subject of subjects) {
      const id = this.docId(`${classId}_${examId}_${subject}`);
      marks = marks.filter((m) => m.id !== id);
      marks = [...marks, { id, classId, examId, subject, maxMarks, scores: bySubject[subject] }];
    }
    this.commit({ marks });
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

  addStudent(input: Omit<Student, 'id' | 'schoolId'>) {
    const id = this.docId(`s${Date.now()}`);
    if (this.fs) {
      void setDoc(doc(this.fs, 'students', id), { ...input, schoolId: this.sid });
      return;
    }
    this.commit({ students: [...this.db().students, { ...input, id }] });
  }

  addTeacher(input: Omit<Teacher, 'id' | 'schoolId'>) {
    const id = this.docId(`t${Date.now()}`);
    if (this.fs) {
      void setDoc(doc(this.fs, 'teachers', id), { ...input, schoolId: this.sid });
      return;
    }
    this.commit({ teachers: [...this.db().teachers, { ...input, id }] });
  }

  addFee(input: Omit<FeeItem, 'id' | 'schoolId'>) {
    // Random suffix: class-wide assignment creates many fees in the same millisecond.
    const id = this.docId(`f${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    if (this.fs) {
      void setDoc(doc(this.fs, 'fees', id), { ...input, schoolId: this.sid });
      return;
    }
    this.commit({ fees: [...this.db().fees, { ...input, id }] });
  }

  /** Gives a brand-new school a sensible weekly timetable to start from. */
  createDefaultTimetable(classId: string) {
    const template = DEMO_TIMETABLES[0];
    if (this.fs) {
      void setDoc(doc(this.fs, 'timetables', this.docId(classId)), {
        schoolId: this.sid,
        classId,
        periods: template.periods,
        gridJson: JSON.stringify(template.grid),
      });
      return;
    }
    this.commit({
      timetables: [...this.db().timetables, { classId, periods: template.periods, grid: template.grid }],
    });
  }

  addSubject(name: string) {
    const clean = name.trim();
    if (!clean || this.subjects().includes(clean)) return;
    this.saveSubjects([...this.subjects(), clean]);
  }

  removeSubject(name: string) {
    this.saveSubjects(this.subjects().filter((s) => s !== name));
  }

  private saveSubjects(names: string[]) {
    if (this.fs) {
      void setDoc(doc(this.fs, 'subjects', this.docId('list')), { schoolId: this.sid, names });
      return;
    }
    this.commit({ subjectsList: names });
  }

  addNotice(notice: Omit<Notice, 'id'>) {
    const id = this.docId(`n${Date.now()}`);
    if (this.fs) {
      void setDoc(doc(this.fs, 'notices', id), { ...notice, schoolId: this.sid });
      return;
    }
    this.commit({ notices: [{ ...notice, id }, ...this.db().notices] });
  }
}
