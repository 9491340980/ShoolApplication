import { Injectable, inject, signal } from '@angular/core';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { environment, firebaseEnabled } from '../../environments/environment';
import { AuthService } from './auth.service';
import { DataService } from './data.service';
import { DEMO_SCHOOL_ID, ShareSnapshot, Student } from './models';
import { NotifyService } from './notify.service';
import { SchoolService } from './school.service';

/** localStorage key prefix used for share snapshots in offline/demo mode. */
const LOCAL_PREFIX = 'vidyasetu-share-';

/**
 * Passwordless parent links. A student gets a stable, unguessable token; we
 * publish a read-only snapshot of just that child to `shares/{token}`, which
 * the `/p/:token` page reads without any login. Also drives the little
 * "send message vs. send link" chooser shown from every WhatsApp button.
 */
@Injectable({ providedIn: 'root' })
export class ShareService {
  private fs = firebaseEnabled() ? inject(Firestore) : null;
  private data = inject(DataService);
  private school = inject(SchoolService);
  private auth = inject(AuthService);
  private notify = inject(NotifyService);

  /** When set, the WhatsApp chooser modal is shown. `textLink` = the existing wa.me message. */
  readonly chooser = signal<{ student: Student; textLink: string } | null>(null);
  readonly busy = signal(false);

  /** Open the two-option chooser for a parent-facing WhatsApp action. */
  openChooser(student: Student, textLink: string) {
    this.chooser.set({ student, textLink });
  }
  closeChooser() {
    this.chooser.set(null);
  }

  /** Option 1 — send the existing text message (attendance/fee/etc.). */
  sendExisting() {
    const c = this.chooser();
    if (!c) return;
    window.open(c.textLink, '_blank');
    this.closeChooser();
  }

  /** Option 2 — send the parent a private link to view their child. */
  async sendLink() {
    const c = this.chooser();
    if (!c) return;
    this.busy.set(true);
    try {
      const url = await this.ensureLink(c.student);
      const msg = this.notify.parentLinkMessage(c.student.name, url);
      window.open(this.notify.whatsappLink(c.student.parentPhone, msg), '_blank');
    } finally {
      this.busy.set(false);
      this.closeChooser();
    }
  }

  /** Create/refresh the child's share snapshot and return the public URL. */
  async ensureLink(student: Student): Promise<string> {
    const token = student.shareToken || this.genToken();
    const snapshot = this.buildSnapshot(student, token);
    if (this.fs) {
      await setDoc(doc(this.fs, 'shares', token), snapshot as unknown as Record<string, unknown>);
    } else {
      localStorage.setItem(LOCAL_PREFIX + token, JSON.stringify(snapshot));
    }
    if (!student.shareToken) this.data.updateStudent(student.id, { shareToken: token });
    return `${location.origin}/p/${token}`;
  }

  /** Read a snapshot (used by the public page in offline/demo mode). */
  readLocal(token: string): ShareSnapshot | null {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_PREFIX + token) || 'null');
    } catch {
      return null;
    }
  }

  private genToken(): string {
    const a = new Uint8Array(18);
    crypto.getRandomValues(a);
    return btoa(String.fromCharCode(...a)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 22);
  }

  private buildSnapshot(student: Student, token: string): ShareSnapshot {
    const att = this.data.studentAttendanceDetail(student.id);
    const fees = this.data.feesOf(student.id).map((f) => ({
      label: f.label,
      amount: f.amount,
      paid: this.data.feePaid(f),
      balance: this.data.feeBalance(f),
    }));
    const exams = this.data
      .schoolExams()
      .map((e) => {
        const subjects = this.data.studentMarks(student.id, e.id);
        if (!subjects.length) return null;
        const total = subjects.reduce((a, s) => a + s.score, 0);
        const max = subjects.reduce((a, s) => a + s.max, 0);
        return { label: e.label, subjects, total, max, pct: max ? Math.round((total / max) * 100) : 0 };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const sid = this.auth.user()?.schoolId ?? DEMO_SCHOOL_ID;
    return {
      token,
      schoolId: sid,
      schoolName: this.school.currentSchool()?.name ?? environment.schoolName,
      logo: this.school.currentSchool()?.logo ?? '',
      studentName: student.name,
      classId: student.classId,
      roll: student.roll,
      attendance: { present: att.present, absent: att.absent, total: att.total, pct: att.pct, byMonth: att.byMonth },
      fees,
      feeTotal: fees.reduce((a, f) => a + f.amount, 0),
      feePaid: fees.reduce((a, f) => a + f.paid, 0),
      feeBalance: fees.reduce((a, f) => a + f.balance, 0),
      exams,
      updatedAt: new Date().toISOString(),
    };
  }
}
