import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
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
  CLASSES,
  DEMO_SCHOOL_ID,
  EXAMS,
  Exam,
  Expense,
  FeeItem,
  FeePayment,
  Homework,
  MarksDoc,
  FeeHead,
  FeeStructure,
  Notice,
  SUBJECTS,
  SalaryComponent,
  SalaryPayout,
  SchoolPermissions,
  StaffSalary,
  Student,
  Subject,
  Teacher,
  TimetableDoc,
} from './models';

const DB_KEY = 'vidyasetu-db-v1';

interface Db {
  students: Student[];
  teachers: Teacher[];
  notices: Notice[];
  homework: Homework[];
  fees: FeeItem[];
  expenses: Expense[];
  attendance: AttendanceDoc[];
  marks: MarksDoc[];
  timetables: TimetableDoc[];
  /** School's own subject list (subject master); empty → default SUBJECTS. */
  subjectsList?: Subject[];
  /** School's own class/section list; empty → default CLASSES. */
  classesList?: string[];
  /** School's own exam list; empty → default EXAMS. */
  examsList?: Exam[];
  /** Per-role tab/permission overrides; null → built-in defaults. */
  permissions?: SchoolPermissions | null;
  /** Class fee-structure templates. */
  feeStructures: FeeStructure[];
  /** Staff salary setup for payroll. */
  salaries: StaffSalary[];
}

const EMPTY_DB: Db = {
  students: [],
  teachers: [],
  notices: [],
  homework: [],
  fees: [],
  expenses: [],
  attendance: [],
  marks: [],
  timetables: [],
  subjectsList: [],
  permissions: null,
  feeStructures: [],
  salaries: [],
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

  /** Active records only — deactivated (recycle-bin) ones are hidden everywhere. */
  readonly students = computed(() => this.db().students.filter((s) => !s.deactivatedAt));
  readonly teachers = computed(() => this.db().teachers.filter((t) => !t.deactivatedAt));
  /** Recycle bin (soft-deleted). */
  readonly deactivatedStudents = computed(() => this.db().students.filter((s) => s.deactivatedAt));
  readonly deactivatedTeachers = computed(() => this.db().teachers.filter((t) => t.deactivatedAt));
  readonly notices = computed(() =>
    [...this.db().notices].sort((a, b) => b.date.localeCompare(a.date)),
  );
  readonly homework = computed(() =>
    [...this.db().homework].sort((a, b) => b.date.localeCompare(a.date)),
  );
  readonly fees = computed(() => this.db().fees);
  readonly expenses = computed(() => [...this.db().expenses].sort((a, b) => b.date.localeCompare(a.date)));
  /** Current school's tab/permission overrides (null → built-in defaults). */
  readonly permissions = computed(() => this.db().permissions ?? null);
  /** True once the current school's permissions snapshot has arrived (always true offline). */
  private permsReadySig = signal(!this.fs);
  readonly permsReady = this.permsReadySig.asReadonly();
  /** Subject master — the school's own list, falling back to sensible defaults. */
  readonly subjects = computed(() => {
    const list = this.db().subjectsList;
    return list && list.length ? list : SUBJECTS;
  });
  /** Class list — the school's own classes/sections, falling back to defaults. */
  readonly schoolClasses = computed(() => {
    const list = this.db().classesList;
    return list && list.length ? list : CLASSES;
  });
  /** Exam list — the school's own exams (FA/SA/slip test), falling back to defaults. */
  readonly schoolExams = computed(() => {
    const list = this.db().examsList;
    return list && list.length ? list : EXAMS;
  });

  readonly monthlyAttendance = DEMO_MONTHLY_ATTENDANCE;
  readonly classAttendanceToday = DEMO_CLASS_ATTENDANCE_TODAY;

  readonly todayStr = new Date().toISOString().slice(0, 10);

  /** classId -> assigned class teacher (the teacher who takes that class's attendance). */
  private assignmentsSig = signal<Record<string, { teacherId: string; teacherName: string }>>(
    this.fs ? {} : this.loadJson('vidyasetu-assign', {}),
  );
  readonly assignments = this.assignmentsSig.asReadonly();

  /** teacherId -> present/absent for today (teacher attendance). */
  private teacherAttSig = signal<Record<string, 'present' | 'absent'>>(this.loadTeacherAttLocal());
  readonly teacherAttToday = this.teacherAttSig.asReadonly();

  private loadJson<T>(key: string, fallback: T): T {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
    } catch {
      return fallback;
    }
  }

  private loadTeacherAttLocal(): Record<string, 'present' | 'absent'> {
    if (this.fs) return {};
    const saved = this.loadJson<{ date: string; statuses: Record<string, 'present' | 'absent'> }>(
      'vidyasetu-teacheratt',
      { date: '', statuses: {} },
    );
    return saved.date === this.todayStr ? saved.statuses : {};
  }

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

  /** Firestore rejects undefined values — drop empty optional fields before writing. */
  private clean<T extends object>(obj: T): T {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
  }

  // ---------- Firestore mode ----------

  private startListeners(schoolId: string) {
    const fs = this.fs;
    if (!fs || this.listeningFor === schoolId) return;
    this.stopListeners();
    this.listeningFor = schoolId;
    this.db.set(EMPTY_DB);
    this.permsReadySig.set(false);

    const plain = ['students', 'teachers', 'notices', 'homework', 'fees', 'expenses', 'attendance', 'marks', 'feeStructures', 'salaries'] as const;
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
        let list: Subject[] = [];
        if (!snap.empty) {
          const d = snap.docs[0].data();
          // New format stores objects; old format stored plain names (max 100).
          if (Array.isArray(d['subjects'])) list = d['subjects'] as Subject[];
          else if (Array.isArray(d['names'])) list = (d['names'] as string[]).map((name) => ({ name, max: 100 }));
        }
        this.db.update((db) => ({ ...db, subjectsList: list }));
      }),
    );

    this.unsubs.push(
      onSnapshot(query(collection(fs, 'classesList'), where('schoolId', '==', schoolId)), (snap) => {
        const names = snap.empty ? [] : ((snap.docs[0].data()['names'] as string[]) ?? []);
        this.db.update((db) => ({ ...db, classesList: names }));
      }),
    );

    this.unsubs.push(
      onSnapshot(query(collection(fs, 'examsList'), where('schoolId', '==', schoolId)), (snap) => {
        const exams = snap.empty ? [] : ((snap.docs[0].data()['exams'] as Exam[]) ?? []);
        this.db.update((db) => ({ ...db, examsList: exams }));
      }),
    );

    // Per-role tab permissions (one doc per school).
    this.unsubs.push(
      onSnapshot(query(collection(fs, 'permissions'), where('schoolId', '==', schoolId)), (snap) => {
        const perms = snap.empty ? null : ({ ...(snap.docs[0].data() as object), id: snap.docs[0].id } as SchoolPermissions);
        this.db.update((db) => ({ ...db, permissions: perms }));
        this.permsReadySig.set(true);
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

    // Class-teacher assignments.
    this.unsubs.push(
      onSnapshot(query(collection(fs, 'assignments'), where('schoolId', '==', schoolId)), (snap) => {
        const map: Record<string, { teacherId: string; teacherName: string }> = {};
        snap.docs.forEach((d) => {
          const x = d.data();
          map[x['classId']] = { teacherId: x['teacherId'], teacherName: x['teacherName'] };
        });
        this.assignmentsSig.set(map);
      }),
    );

    // Today's teacher attendance.
    this.unsubs.push(
      onSnapshot(doc(fs, 'teacherAttendance', `${schoolId}_${this.todayStr}`), (snap) => {
        this.teacherAttSig.set(snap.exists() ? (snap.data()['statuses'] ?? {}) : {});
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
      homework: [],
      fees: DEMO_FEES,
      expenses: [],
      attendance: DEMO_ATTENDANCE,
      marks: DEMO_MARKS,
      timetables: DEMO_TIMETABLES,
      // Offline demo enables every role; Certificates stays off until enabled (still in testing).
      permissions: { schoolId: DEMO_SCHOOL_ID, roles: {}, disabledModules: ['/certificates', '/payroll'], disabledRoles: [] },
      feeStructures: [],
      salaries: [],
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
    return this.db().students.filter((s) => s.classId === classId && !s.deactivatedAt);
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

  /**
   * Real attendance from saved records (present days / marked days).
   * Falls back to the stored demo value only when no attendance has been marked.
   */
  studentAttendance(studentId: string): { present: number; total: number; pct: number | null } {
    const stu = this.student(studentId);
    if (!stu) return { present: 0, total: 0, pct: null };
    const keys = [studentId, stu.id, stu.id.replace(`${this.sid}_`, '')];
    let present = 0;
    let total = 0;
    for (const a of this.db().attendance) {
      if (a.classId !== stu.classId) continue;
      const k = keys.find((key) => a.statuses[key] !== undefined);
      if (k === undefined) continue;
      total++;
      if (a.statuses[k] === 'present') present++;
    }
    if (total > 0) return { present, total, pct: Math.round((present / total) * 100) };
    return { present: 0, total: 0, pct: stu.attendancePct ?? null };
  }

  /** Detailed attendance history for a student: totals, monthly split, and absent dates. */
  studentAttendanceDetail(studentId: string): {
    present: number;
    absent: number;
    total: number;
    pct: number | null;
    absentDates: string[];
    byMonth: { month: string; present: number; absent: number }[];
  } {
    const stu = this.student(studentId);
    if (!stu) return { present: 0, absent: 0, total: 0, pct: null, absentDates: [], byMonth: [] };
    const keys = [studentId, stu.id, stu.id.replace(`${this.sid}_`, '')];
    const recs: { date: string; present: boolean }[] = [];
    for (const a of this.db().attendance) {
      if (a.classId !== stu.classId) continue;
      const k = keys.find((key) => a.statuses[key] !== undefined);
      if (k === undefined) continue;
      recs.push({ date: a.date, present: a.statuses[k] === 'present' });
    }
    recs.sort((a, b) => a.date.localeCompare(b.date));
    const present = recs.filter((r) => r.present).length;
    const total = recs.length;
    const monthMap = new Map<string, { present: number; absent: number }>();
    for (const r of recs) {
      const m = r.date.slice(0, 7);
      const e = monthMap.get(m) ?? { present: 0, absent: 0 };
      if (r.present) e.present++;
      else e.absent++;
      monthMap.set(m, e);
    }
    return {
      present,
      absent: total - present,
      total,
      pct: total ? Math.round((present / total) * 100) : null,
      absentDates: recs.filter((r) => !r.present).map((r) => r.date),
      byMonth: [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, v]) => ({ month, ...v })),
    };
  }

  /** date → present/absent for one student (from the already-loaded attendance records). */
  studentAttendanceMap(studentId: string): Record<string, 'present' | 'absent'> {
    const stu = this.student(studentId);
    if (!stu) return {};
    const keys = [studentId, stu.id, stu.id.replace(`${this.sid}_`, '')];
    const map: Record<string, 'present' | 'absent'> = {};
    for (const a of this.db().attendance) {
      if (a.classId !== stu.classId) continue;
      const k = keys.find((key) => a.statuses[key] !== undefined);
      if (k !== undefined) map[a.date] = a.statuses[k];
    }
    return map;
  }

  /** date → present/absent for one teacher across all recorded days (fetched on demand). */
  async teacherAttendanceMap(teacherId: string): Promise<Record<string, 'present' | 'absent'>> {
    const map: Record<string, 'present' | 'absent'> = {};
    if (!this.fs) {
      const t = this.teacherAttSig()[teacherId];
      if (t) map[this.todayStr] = t;
      return map;
    }
    const snap = await getDocs(query(collection(this.fs, 'teacherAttendance'), where('schoolId', '==', this.sid)));
    snap.forEach((d) => {
      const data = d.data() as { date: string; statuses: Record<string, 'present' | 'absent'> };
      const st = data.statuses?.[teacherId];
      if (st) map[data.date] = st;
    });
    return map;
  }

  /** Amount collected so far — from the payment history, falling back to older records. */
  feePaid(f: FeeItem): number {
    if (f.payments?.length) return f.payments.reduce((a, p) => a + p.amount, 0);
    return f.paidAmount ?? (f.status === 'paid' ? f.amount : 0);
  }
  feeBalance(f: FeeItem): number {
    return Math.max(0, f.amount - (f.concession ?? 0) - this.feePaid(f));
  }
  feePayments(f: FeeItem): FeePayment[] {
    if (f.payments?.length) return f.payments;
    const paid = this.feePaid(f);
    return paid > 0 ? [{ date: f.dueDate, amount: paid }] : [];
  }

  /** Real fee status from fee records; falls back to stored demo value. */
  studentFeeStatus(studentId: string): 'paid' | 'pending' | null {
    const fees = this.feesOf(studentId);
    if (fees.length) return fees.some((f) => this.feeBalance(f) > 0) ? 'pending' : 'paid';
    return this.student(studentId)?.feeStatus ?? null;
  }

  // ---------- class-teacher assignments ----------

  classTeacherOf(classId: string): { teacherId: string; teacherName: string } | undefined {
    return this.assignments()[classId];
  }

  /** Classes this teacher is the (current) class teacher of — the only ones they may manage. */
  classesForTeacher(userId: string): string[] {
    return Object.entries(this.assignments())
      .filter(([, v]) => v.teacherId === userId)
      .map(([classId]) => classId)
      .sort();
  }

  assignClassTeacher(classId: string, teacherId: string, teacherName: string) {
    if (this.fs) {
      void setDoc(doc(this.fs, 'assignments', this.docId(classId)), {
        schoolId: this.sid,
        classId,
        teacherId,
        teacherName,
      });
      return;
    }
    const next = { ...this.assignmentsSig(), [classId]: { teacherId, teacherName } };
    this.assignmentsSig.set(next);
    localStorage.setItem('vidyasetu-assign', JSON.stringify(next));
  }

  clearClassTeacher(classId: string) {
    if (this.fs) {
      void deleteDoc(doc(this.fs, 'assignments', this.docId(classId)));
      return;
    }
    const next = { ...this.assignmentsSig() };
    delete next[classId];
    this.assignmentsSig.set(next);
    localStorage.setItem('vidyasetu-assign', JSON.stringify(next));
  }

  // ---------- teacher attendance (today) ----------

  markTeacher(teacherId: string, status: 'present' | 'absent') {
    const next = { ...this.teacherAttSig(), [teacherId]: status };
    if (this.fs) {
      void setDoc(doc(this.fs, 'teacherAttendance', `${this.sid}_${this.todayStr}`), {
        schoolId: this.sid,
        date: this.todayStr,
        statuses: next,
      });
      return;
    }
    this.teacherAttSig.set(next);
    localStorage.setItem('vidyasetu-teacheratt', JSON.stringify({ date: this.todayStr, statuses: next }));
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

  /** Save the whole class × all-subjects grid in one go (one doc per subject, each with its own max). */
  saveMarksMatrix(
    classId: string,
    examId: string,
    entries: { subject: string; max: number; scores: Record<string, number> }[],
  ) {
    if (this.fs) {
      const batch = writeBatch(this.fs);
      for (const e of entries) {
        const id = this.docId(`${classId}_${examId}_${e.subject}`);
        batch.set(doc(this.fs, 'marks', id), {
          schoolId: this.sid,
          classId,
          examId,
          subject: e.subject,
          maxMarks: e.max,
          scores: e.scores,
        });
      }
      void batch.commit();
      return;
    }
    let marks = this.db().marks;
    for (const e of entries) {
      const id = this.docId(`${classId}_${examId}_${e.subject}`);
      marks = marks.filter((m) => m.id !== id);
      marks = [...marks, { id, classId, examId, subject: e.subject, maxMarks: e.max, scores: e.scores }];
    }
    this.commit({ marks });
  }

  private payerName(): string {
    return this.auth.user()?.name ?? '';
  }

  markFeePaid(feeId: string, method = 'Cash') {
    const f = this.db().fees.find((x) => x.id === feeId);
    if (!f) return;
    const bal = this.feeBalance(f);
    const payments = bal > 0 ? [...this.feePayments(f), { date: this.todayStr, amount: bal, method, by: this.payerName() }] : this.feePayments(f);
    this.writeFee(f.id, { payments, paidAmount: this.feePaid(f) + Math.max(0, bal), status: 'paid' });
  }

  /** Collect an installment against a fee — records a dated payment (with method) and updates the balance. */
  collectFee(feeId: string, installment: number, method = 'Cash') {
    const f = this.db().fees.find((x) => x.id === feeId);
    if (!f || installment <= 0) return;
    const add = Math.min(installment, this.feeBalance(f));
    if (add <= 0) return;
    const payments = [...this.feePayments(f), { date: this.todayStr, amount: add, method, by: this.payerName() }];
    const paid = this.feePaid(f) + add;
    this.writeFee(f.id, { payments, paidAmount: paid, status: paid + (f.concession ?? 0) >= f.amount ? 'paid' : 'pending' });
  }

  /** Set or clear a concession/scholarship on a fee (audited). */
  setConcession(feeId: string, amount: number, reason: string) {
    const f = this.db().fees.find((x) => x.id === feeId);
    if (!f) return;
    const conc = Math.max(0, Math.min(Math.floor(Number(amount) || 0), f.amount));
    const paid = this.feePaid(f);
    this.writeFee(f.id, {
      concession: conc,
      concessionReason: reason.trim(),
      concessionBy: this.payerName(),
      concessionAt: new Date().toISOString(),
      status: paid + conc >= f.amount ? 'paid' : 'pending',
    });
  }

  /** Every recorded fee payment, flattened for the daily collection report. */
  feeCollections(): { studentId: string; label: string; date: string; amount: number; method: string; by: string }[] {
    const out: { studentId: string; label: string; date: string; amount: number; method: string; by: string }[] = [];
    for (const f of this.db().fees) {
      for (const p of f.payments ?? []) {
        out.push({ studentId: f.studentId, label: f.label, date: p.date, amount: p.amount, method: p.method ?? 'Cash', by: p.by ?? '' });
      }
    }
    return out;
  }

  setFeeStatus(feeId: string, status: 'paid' | 'pending') {
    const f = this.db().fees.find((x) => x.id === feeId);
    if (!f) return;
    if (status === 'paid') {
      this.markFeePaid(feeId);
    } else {
      this.writeFee(f.id, { payments: [], paidAmount: 0, status: 'pending' });
    }
  }

  private writeFee(feeId: string, patch: Partial<FeeItem>) {
    if (this.fs) {
      void updateDoc(doc(this.fs, 'fees', feeId), patch);
      return;
    }
    this.commit({ fees: this.db().fees.map((f) => (f.id === feeId ? { ...f, ...patch } : f)) });
  }

  updateStudent(id: string, patch: Partial<Student>) {
    if (this.fs) {
      void updateDoc(doc(this.fs, 'students', id), this.clean(patch));
      return;
    }
    this.commit({ students: this.db().students.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  }

  updateTeacher(id: string, patch: Partial<Teacher>) {
    if (this.fs) {
      void updateDoc(doc(this.fs, 'teachers', id), this.clean(patch));
      return;
    }
    this.commit({ teachers: this.db().teachers.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  }

  // ---------- recycle bin (soft delete + 30-day retention) ----------

  /** Days kept in the recycle bin before a record is removed for good. */
  readonly RETENTION_DAYS = 30;

  /** Records in other modules that make a hard delete unsafe → deactivate instead. */
  studentDeps(id: string): { attendance: number; marks: number; fees: number; has: boolean } {
    const stu = this.db().students.find((s) => s.id === id);
    const keys = stu ? [id, stu.id, stu.id.replace(`${this.sid}_`, '')] : [id];
    const attendance = this.db().attendance.filter((a) => keys.some((k) => a.statuses[k] !== undefined)).length;
    const marks = this.db().marks.filter((m) => keys.some((k) => m.scores[k] !== undefined)).length;
    const fees = this.db().fees.filter((f) => keys.includes(f.studentId)).length;
    return { attendance, marks, fees, has: attendance + marks + fees > 0 };
  }
  teacherDeps(id: string): { classes: number; assignments: number; has: boolean } {
    const t = this.db().teachers.find((x) => x.id === id);
    const classes = t?.classes.length ?? 0;
    const assignments = Object.values(this.assignments()).filter((a) => a.teacherName === t?.name).length;
    return { classes, assignments, has: classes + assignments > 0 };
  }

  /** Days remaining before a recycle-bin record is purged (0 = due now). */
  daysLeft(deactivatedAt?: string | null): number {
    if (!deactivatedAt) return this.RETENTION_DAYS;
    const elapsed = (Date.now() - new Date(deactivatedAt).getTime()) / 86400000;
    return Math.max(0, Math.ceil(this.RETENTION_DAYS - elapsed));
  }

  deactivateStudent(id: string) {
    this.updateStudent(id, { deactivatedAt: new Date().toISOString() });
  }
  restoreStudent(id: string) {
    this.updateStudent(id, { deactivatedAt: null });
  }
  deactivateTeacher(id: string) {
    this.updateTeacher(id, { deactivatedAt: new Date().toISOString() });
  }
  restoreTeacher(id: string) {
    this.updateTeacher(id, { deactivatedAt: null });
  }

  /** Permanently remove a student (and their fee records). */
  deleteStudent(id: string) {
    const stu = this.db().students.find((s) => s.id === id);
    const keys = stu ? [id, stu.id, stu.id.replace(`${this.sid}_`, '')] : [id];
    const feeIds = this.db().fees.filter((f) => keys.includes(f.studentId)).map((f) => f.id);
    if (this.fs) {
      void deleteDoc(doc(this.fs, 'students', id));
      feeIds.forEach((fid) => void deleteDoc(doc(this.fs!, 'fees', fid)));
      return;
    }
    this.commit({
      students: this.db().students.filter((s) => s.id !== id),
      fees: this.db().fees.filter((f) => !feeIds.includes(f.id)),
    });
  }
  deleteTeacher(id: string) {
    if (this.fs) {
      void deleteDoc(doc(this.fs, 'teachers', id));
      return;
    }
    this.commit({ teachers: this.db().teachers.filter((t) => t.id !== id) });
  }

  /** Remove recycle-bin records older than the retention window (called when the bin is viewed). */
  purgeExpired() {
    const cutoff = Date.now() - this.RETENTION_DAYS * 86400000;
    this.db().students
      .filter((s) => s.deactivatedAt && new Date(s.deactivatedAt).getTime() < cutoff)
      .forEach((s) => this.deleteStudent(s.id));
    this.db().teachers
      .filter((t) => t.deactivatedAt && new Date(t.deactivatedAt).getTime() < cutoff)
      .forEach((t) => this.deleteTeacher(t.id));
  }

  private feeSlug(label: string): string {
    return label.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) || 'fee';
  }

  /** The single fee record for a student under a given label (term). */
  feeFor(student: Student, label: string): FeeItem | undefined {
    const id = `${student.id}_fee_${this.feeSlug(label)}`;
    return this.db().fees.find((f) => f.id === id);
  }

  /**
   * Set (or clear) a student's fee amount for a term label. One deterministic
   * record per student+label, so editing the amount updates rather than dupes.
   * Amount <= 0 removes the fee. Preserves paid/pending status on edits.
   */
  setStudentFee(student: Student, label: string, amount: number, dueDate?: string) {
    const id = `${student.id}_fee_${this.feeSlug(label)}`;
    if (!amount || amount <= 0) {
      if (this.fs) void deleteDoc(doc(this.fs, 'fees', id));
      else this.commit({ fees: this.db().fees.filter((f) => f.id !== id) });
      return;
    }
    const existing = this.db().fees.find((f) => f.id === id);
    // Keep the full installment history; never lose collected amounts when the total is edited.
    const payments = existing ? this.feePayments(existing) : [];
    const paid = payments.reduce((a, p) => a + p.amount, 0);
    const conc = existing?.concession ?? 0;
    const rec = {
      studentId: student.id,
      label,
      amount,
      payments,
      paidAmount: paid,
      dueDate: dueDate ?? existing?.dueDate ?? this.todayStr,
      status: paid + conc >= amount ? ('paid' as const) : ('pending' as const),
    };
    if (this.fs) {
      void setDoc(doc(this.fs, 'fees', id), this.clean({ ...rec, schoolId: this.sid }));
      return;
    }
    const rest = this.db().fees.filter((f) => f.id !== id);
    this.commit({ fees: [...rest, { ...rec, id }] });
  }

  // ---------- fee structure templates ----------

  readonly feeStructures = computed(() => this.db().feeStructures);
  structureFor(classId: string): FeeStructure | undefined {
    return this.db().feeStructures.find((s) => s.classId === classId);
  }
  saveStructure(classId: string, heads: FeeHead[]) {
    const id = this.docId(`struct_${classId}`);
    const clean = heads.filter((h) => h.label.trim() && h.amount > 0).map((h) => ({ label: h.label.trim(), amount: Math.floor(h.amount), dueDate: h.dueDate || '' }));
    const rec = { schoolId: this.sid, classId, heads: clean };
    if (this.fs) {
      void setDoc(doc(this.fs, 'feeStructures', id), rec);
      return;
    }
    const rest = this.db().feeStructures.filter((s) => s.classId !== classId);
    this.commit({ feeStructures: [...rest, { ...rec, id }] });
  }
  /** Apply a class's structure to every student in it (creates/updates a fee per head). */
  applyStructure(classId: string): number {
    const struct = this.structureFor(classId);
    if (!struct?.heads.length) return 0;
    const studs = this.studentsOf(classId);
    for (const s of studs) for (const h of struct.heads) this.setStudentFee(s, h.label, h.amount, h.dueDate || undefined);
    return studs.length * struct.heads.length;
  }

  // ---------- staff payroll ----------

  readonly salaries = computed(() => [...this.db().salaries].sort((a, b) => a.name.localeCompare(b.name)));

  /** Net pay = base + allowances − deductions (never below 0). */
  netSalary(s: StaffSalary): number {
    const add = (s.allowances ?? []).reduce((a, c) => a + (c.amount || 0), 0);
    const cut = (s.deductions ?? []).reduce((a, c) => a + (c.amount || 0), 0);
    return Math.max(0, Math.round(s.monthlySalary + add - cut));
  }
  /** Has this staff member been paid for the month? */
  staffPaidFor(s: StaffSalary, month: string): SalaryPayout | undefined {
    return (s.payouts ?? []).find((p) => p.month === month);
  }

  setSalary(input: { id?: string; name: string; role?: string; monthlySalary: number; allowances?: SalaryComponent[]; deductions?: SalaryComponent[] }) {
    const name = input.name.trim();
    if (!name || input.monthlySalary <= 0) return;
    const existing = input.id ? this.db().salaries.find((s) => s.id === input.id) : undefined;
    const id = input.id ?? this.docId(`sal${Date.now()}-${Math.floor(Math.random() * 1000)}`);
    const clean = (list?: SalaryComponent[]) => (list ?? []).filter((c) => c.label.trim() && c.amount > 0).map((c) => ({ label: c.label.trim(), amount: Math.round(c.amount) }));
    const rec: StaffSalary = {
      id,
      schoolId: this.sid,
      name,
      role: input.role ?? '',
      monthlySalary: Math.round(input.monthlySalary),
      allowances: clean(input.allowances),
      deductions: clean(input.deductions),
      payouts: existing?.payouts ?? [],
    };
    if (this.fs) {
      void setDoc(doc(this.fs, 'salaries', id), this.clean(rec));
      return;
    }
    const rest = this.db().salaries.filter((s) => s.id !== id);
    this.commit({ salaries: [...rest, rec] });
  }
  removeSalary(id: string) {
    if (this.fs) {
      void deleteDoc(doc(this.fs, 'salaries', id));
      return;
    }
    this.commit({ salaries: this.db().salaries.filter((s) => s.id !== id) });
  }

  private saveSalaryRec(id: string, patch: Partial<StaffSalary>) {
    if (this.fs) void updateDoc(doc(this.fs, 'salaries', id), this.clean(patch));
    else this.commit({ salaries: this.db().salaries.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  }

  /** Pay a staff member for a month: posts a linked Salaries expense and records the payout. */
  payStaff(id: string, month: string, method = 'Bank'): boolean {
    const s = this.db().salaries.find((x) => x.id === id);
    if (!s || this.staffPaidFor(s, month)) return false;
    const amount = this.netSalary(s);
    const expenseId = this.addExpense({
      type: 'expense',
      date: `${month}-28`,
      category: 'Salaries',
      description: `Salary ${month} — ${s.name}${s.role ? ' (' + s.role + ')' : ''}`,
      amount,
      method,
      payee: s.name,
      createdBy: this.payerName(),
      source: 'payroll',
      refId: `${id}:${month}`,
      period: month,
      locked: true,
    });
    const payout: SalaryPayout = { month, date: this.todayStr, amount, method, expenseId };
    this.saveSalaryRec(id, { payouts: [...(s.payouts ?? []), payout] });
    return true;
  }
  /** Reverse a month's payment: deletes the linked cash-book expense and drops the payout. */
  reversePay(id: string, month: string): boolean {
    const s = this.db().salaries.find((x) => x.id === id);
    const payout = s ? this.staffPaidFor(s, month) : undefined;
    if (!s || !payout) return false;
    this.deleteExpense(payout.expenseId);
    this.saveSalaryRec(id, { payouts: (s.payouts ?? []).filter((p) => p.month !== month) });
    return true;
  }
  /** Pay all unpaid staff for a month. Returns how many were posted. */
  payAllStaff(month: string, method = 'Bank'): number {
    let n = 0;
    for (const s of this.db().salaries) if (this.payStaff(s.id, month, method)) n++;
    return n;
  }

  addStudent(input: Omit<Student, 'id' | 'schoolId'>) {
    const id = this.docId(`s${Date.now()}`);
    if (this.fs) {
      void setDoc(doc(this.fs, 'students', id), this.clean({ ...input, schoolId: this.sid }));
      return;
    }
    this.commit({ students: [...this.db().students, { ...input, id }] });
  }

  /** Bulk-create students (Excel/CSV import). Batched for Firestore's 500-op limit. */
  async addStudentsBulk(rows: Omit<Student, 'id' | 'schoolId'>[]): Promise<number> {
    if (this.fs) {
      const fs = this.fs;
      let written = 0;
      for (let i = 0; i < rows.length; i += 400) {
        const batch = writeBatch(fs);
        rows.slice(i, i + 400).forEach((r, j) => {
          const id = this.docId(`s${Date.now()}-${i + j}-${Math.random().toString(36).slice(2, 6)}`);
          batch.set(doc(fs, 'students', id), this.clean({ ...r, schoolId: this.sid }));
        });
        await batch.commit();
        written += Math.min(400, rows.length - i);
      }
      return written;
    }
    const next = rows.map((r, i) => ({ ...r, id: `s${Date.now()}-${i}` }));
    this.commit({ students: [...this.db().students, ...next] });
    return next.length;
  }

  /** Promote (or graduate) a whole class: move every student to the target class. */
  /**
   * Apply a whole promotion plan atomically. `plan` maps each source class to a
   * target (another class, the same class to keep, or 'PASSED' to graduate).
   * Every student moves in one shot, and roll numbers in each receiving class are
   * re-sequenced 1..N so two cohorts can never end up with clashing rolls.
   */
  async promoteAll(plan: { from: string; to: string }[]): Promise<{ moved: number; graduated: number }> {
    const map = new Map(plan.filter((p) => p.to && p.to !== p.from).map((p) => [p.from, p.to]));
    if (!map.size) return { moved: 0, graduated: 0 };
    const students = this.db().students;
    const finalClass = (s: Student) => map.get(s.classId) ?? s.classId;

    const moved = students.filter((s) => finalClass(s) !== s.classId);
    const updates: { id: string; classId: string; roll?: string }[] = [];

    // Re-sequence rolls only in active classes that actually receive someone.
    const affected = new Set(moved.map((s) => finalClass(s)).filter((c) => c !== 'PASSED'));
    for (const cls of affected) {
      const roster = students
        .filter((s) => finalClass(s) === cls)
        .sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0) || a.name.localeCompare(b.name));
      roster.forEach((s, i) => {
        const roll = String(i + 1);
        if (s.classId !== cls || s.roll !== roll) updates.push({ id: s.id, classId: cls, roll });
      });
    }
    // Graduating students leave the active roster.
    let graduated = 0;
    for (const s of students) {
      if (finalClass(s) === 'PASSED' && s.classId !== 'PASSED') {
        updates.push({ id: s.id, classId: 'PASSED' });
        graduated++;
      }
    }

    if (this.fs) {
      const fs = this.fs;
      for (let i = 0; i < updates.length; i += 450) {
        const batch = writeBatch(fs);
        for (const u of updates.slice(i, i + 450)) {
          batch.update(doc(fs, 'students', u.id), u.roll !== undefined ? { classId: u.classId, roll: u.roll } : { classId: u.classId });
        }
        await batch.commit();
      }
    } else {
      const byId = new Map(updates.map((u) => [u.id, u]));
      this.commit({ students: students.map((s) => (byId.has(s.id) ? { ...s, ...byId.get(s.id)! } : s)) });
    }
    return { moved: moved.length, graduated };
  }

  addTeacher(input: Omit<Teacher, 'id' | 'schoolId'>) {
    const id = this.docId(`t${Date.now()}`);
    if (this.fs) {
      void setDoc(doc(this.fs, 'teachers', id), this.clean({ ...input, schoolId: this.sid }));
      return;
    }
    this.commit({ teachers: [...this.db().teachers, { ...input, id }] });
  }

  addFee(input: Omit<FeeItem, 'id' | 'schoolId'>) {
    // Random suffix: class-wide assignment creates many fees in the same millisecond.
    const id = this.docId(`f${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    if (this.fs) {
      void setDoc(doc(this.fs, 'fees', id), this.clean({ ...input, schoolId: this.sid }));
      return;
    }
    this.commit({ fees: [...this.db().fees, { ...input, id }] });
  }

  addExpense(input: Omit<Expense, 'id' | 'schoolId'>): string {
    const id = this.docId(`exp${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    if (this.fs) void setDoc(doc(this.fs, 'expenses', id), this.clean({ ...input, schoolId: this.sid }));
    else this.commit({ expenses: [...this.db().expenses, { ...input, id }] });
    return id;
  }

  updateExpense(id: string, patch: Partial<Expense>) {
    if (this.fs) {
      void updateDoc(doc(this.fs, 'expenses', id), this.clean(patch));
      return;
    }
    this.commit({ expenses: this.db().expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  }

  deleteExpense(id: string) {
    if (this.fs) {
      void deleteDoc(doc(this.fs, 'expenses', id));
      return;
    }
    this.commit({ expenses: this.db().expenses.filter((e) => e.id !== id) });
  }

  // ---------- role permissions ----------

  /** Load a specific school's permission doc once (used by the super admin to edit any school). */
  async fetchPermissions(schoolId: string): Promise<SchoolPermissions | null> {
    if (!this.fs) {
      const local = this.loadJson<SchoolPermissions | null>(`vidyasetu-perms-${schoolId}`, null);
      return local;
    }
    const snap = await getDoc(doc(this.fs, 'permissions', `${schoolId}_perms`));
    return snap.exists() ? ({ ...(snap.data() as object), id: snap.id } as SchoolPermissions) : null;
  }

  /** Save the per-role grants and the school's module/role switches. */
  async savePermissions(
    schoolId: string,
    payload: { roles: SchoolPermissions['roles']; disabledModules?: string[]; disabledRoles?: SchoolPermissions['disabledRoles'] },
  ): Promise<void> {
    const next: SchoolPermissions = {
      schoolId,
      roles: payload.roles,
      disabledModules: payload.disabledModules ?? [],
      disabledRoles: payload.disabledRoles ?? [],
    };
    if (!this.fs) {
      localStorage.setItem(`vidyasetu-perms-${schoolId}`, JSON.stringify(next));
      if (schoolId === this.sid) this.commit({ permissions: next });
      return;
    }
    await setDoc(doc(this.fs, 'permissions', `${schoolId}_perms`), next);
  }

  /** Gives a brand-new school a sensible weekly timetable to start from. */
  createDefaultTimetable(classId: string) {
    const template = DEMO_TIMETABLES[0];
    this.saveTimetable(classId, template.periods, template.grid);
  }

  /** Save an edited timetable for a class (grid stored as JSON — Firestore can't nest arrays). */
  saveTimetable(classId: string, periods: string[], grid: string[][]) {
    if (this.fs) {
      void setDoc(doc(this.fs, 'timetables', this.docId(classId)), {
        schoolId: this.sid,
        classId,
        periods,
        gridJson: JSON.stringify(grid),
      });
      return;
    }
    const rest = this.db().timetables.filter((t) => t.classId !== classId);
    this.commit({ timetables: [...rest, { classId, periods, grid }] });
  }

  addSubject(name: string, max = 100, group?: string, label?: string) {
    const clean = name.trim();
    if (!clean || this.subjects().some((s) => s.name === clean)) return;
    const sub: Subject = { name: clean, max: Math.max(1, max) };
    if (group?.trim()) sub.group = group.trim();
    if (label?.trim()) sub.label = label.trim();
    this.saveSubjects([...this.subjects(), sub]);
  }

  removeSubject(name: string) {
    // Removes a standalone subject, or every part of a collapsed split group.
    this.saveSubjects(this.subjects().filter((s) => s.name !== name && s.group !== name));
  }

  private saveSubjects(subjects: Subject[]) {
    if (this.fs) {
      void setDoc(doc(this.fs, 'subjects', this.docId('list')), { schoolId: this.sid, subjects });
      return;
    }
    this.commit({ subjectsList: subjects });
  }

  addClass(name: string) {
    const clean = name.trim().toUpperCase();
    if (!clean || this.schoolClasses().includes(clean)) return;
    this.saveClasses([...this.schoolClasses(), clean]);
  }

  removeClass(name: string) {
    this.saveClasses(this.schoolClasses().filter((c) => c !== name));
  }

  private saveClasses(names: string[]) {
    if (this.fs) {
      void setDoc(doc(this.fs, 'classesList', this.docId('list')), { schoolId: this.sid, names });
      return;
    }
    this.commit({ classesList: names });
  }

  addExam(label: string, maxMarks = 100) {
    const clean = label.trim();
    if (!clean) return;
    const id = clean.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) || `e${Date.now()}`;
    if (this.schoolExams().some((e) => e.id === id)) return;
    this.saveExams([...this.schoolExams(), { id, label: clean, maxMarks: Math.max(1, Math.floor(maxMarks) || 100) }]);
  }

  removeExam(id: string) {
    this.saveExams(this.schoolExams().filter((e) => e.id !== id));
  }

  /** Rename an exam, keeping its id so marks already entered stay linked to it. */
  renameExam(id: string, label: string) {
    const clean = label.trim();
    if (!clean) return;
    this.saveExams(this.schoolExams().map((e) => (e.id === id ? { ...e, label: clean } : e)));
  }

  /** Set an exam's max marks per subject (e.g. FA = 25, SA = 100). */
  setExamMax(id: string, maxMarks: number) {
    const m = Math.max(1, Math.floor(Number(maxMarks) || 1));
    this.saveExams(this.schoolExams().map((e) => (e.id === id ? { ...e, maxMarks: m } : e)));
  }

  private saveExams(exams: Exam[]) {
    if (this.fs) {
      void setDoc(doc(this.fs, 'examsList', this.docId('list')), { schoolId: this.sid, exams });
      return;
    }
    this.commit({ examsList: exams });
  }

  addHomework(hw: Omit<Homework, 'id'>) {
    const id = this.docId(`hw${Date.now()}`);
    if (this.fs) {
      void setDoc(doc(this.fs, 'homework', id), { ...hw, schoolId: this.sid });
      return;
    }
    this.commit({ homework: [{ ...hw, id }, ...this.db().homework] });
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
