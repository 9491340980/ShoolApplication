import { Injectable, effect, inject, signal } from '@angular/core';
import {
  Firestore,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { environment, firebaseEnabled } from '../../environments/environment';
import { AuthService } from './auth.service';
import { AppUser, Role, School } from './models';

/**
 * Multi-tenant administration:
 * - Super admin: create and activate/deactivate schools.
 * - Head Master: create teacher/parent/student accounts for their own school.
 * - Everyone: `currentSchool` powers the white-label school name in the shell.
 */
@Injectable({ providedIn: 'root' })
export class SchoolService {
  private fs = firebaseEnabled() ? inject(Firestore) : null;
  private auth = inject(AuthService);

  /** All schools — populated only for the super admin. */
  readonly schools = signal<School[]>([]);
  /** Users of the current school — populated only for the head master. */
  readonly schoolUsers = signal<AppUser[]>([]);
  /** The signed-in user's school (white-label branding). */
  readonly currentSchool = signal<School | null>(null);

  /** Super-admin: teachers & class-teacher assignments of the school being managed. */
  readonly mgmtTeachers = signal<AppUser[]>([]);
  readonly mgmtAssignments = signal<Record<string, { teacherId: string; teacherName: string }>>({});

  private schoolsUnsub?: () => void;
  private usersUnsub?: () => void;
  private schoolUnsub?: () => void;
  private mgmtUnsubs: (() => void)[] = [];

  constructor() {
    effect(() => {
      const user = this.auth.user();
      this.teardown();
      if (!this.fs || !user) return;

      if (user.role === 'superadmin') {
        this.schoolsUnsub = onSnapshot(collection(this.fs, 'schools'), (snap) => {
          this.schools.set(
            snap.docs
              .map((d) => ({ ...(d.data() as Omit<School, 'id'>), id: d.id }))
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          );
        });
        return;
      }

      if (user.schoolId) {
        this.schoolUnsub = onSnapshot(doc(this.fs, 'schools', user.schoolId), (snap) => {
          this.currentSchool.set(snap.exists() ? { ...(snap.data() as Omit<School, 'id'>), id: snap.id } : null);
        });
        if (user.role === 'headmaster') {
          this.usersUnsub = onSnapshot(
            query(collection(this.fs, 'users'), where('schoolId', '==', user.schoolId)),
            (snap) => {
              this.schoolUsers.set(snap.docs.map((d) => ({ ...(d.data() as Omit<AppUser, 'id'>), id: d.id })));
            },
          );
        }
      }
    });
  }

  private teardown() {
    this.schoolsUnsub?.();
    this.usersUnsub?.();
    this.schoolUnsub?.();
    this.schoolsUnsub = this.usersUnsub = this.schoolUnsub = undefined;
    this.schools.set([]);
    this.schoolUsers.set([]);
    this.currentSchool.set(null);
  }

  // ---- super admin ----

  async addSchool(name: string, adminEmail: string, phone: string, address: string): Promise<string | null> {
    if (!this.fs) return 'Firebase is not connected.';
    const id = `sch-${Date.now()}`;
    try {
      await setDoc(doc(this.fs, 'schools', id), {
        name: name.trim(),
        adminEmail: adminEmail.trim().toLowerCase(),
        phone: phone.trim(),
        address: address.trim(),
        active: true,
        createdAt: new Date().toISOString().slice(0, 10),
      });
      return null;
    } catch {
      return 'Could not create school. Check Firestore rules.';
    }
  }

  async setSchoolActive(schoolId: string, active: boolean) {
    if (!this.fs) return;
    await updateDoc(doc(this.fs, 'schools', schoolId), { active });
  }

  // ---- super admin: manage a specific school's class teachers ----

  /** Start live-loading the chosen school's teachers + class-teacher assignments. */
  openSchoolManagement(schoolId: string) {
    this.closeSchoolManagement();
    if (!this.fs) return;
    this.mgmtUnsubs.push(
      onSnapshot(query(collection(this.fs, 'users'), where('schoolId', '==', schoolId)), (snap) => {
        this.mgmtTeachers.set(
          snap.docs
            .map((d) => ({ ...(d.data() as Omit<AppUser, 'id'>), id: d.id }))
            .filter((u) => u.role === 'teacher'),
        );
      }),
    );
    this.mgmtUnsubs.push(
      onSnapshot(query(collection(this.fs, 'assignments'), where('schoolId', '==', schoolId)), (snap) => {
        const map: Record<string, { teacherId: string; teacherName: string }> = {};
        snap.docs.forEach((d) => {
          const x = d.data();
          map[x['classId']] = { teacherId: x['teacherId'], teacherName: x['teacherName'] };
        });
        this.mgmtAssignments.set(map);
      }),
    );
  }

  closeSchoolManagement() {
    this.mgmtUnsubs.forEach((u) => u());
    this.mgmtUnsubs = [];
    this.mgmtTeachers.set([]);
    this.mgmtAssignments.set({});
  }

  assignClassTeacherFor(schoolId: string, classId: string, teacherId: string, teacherName: string) {
    if (!this.fs) return;
    void setDoc(doc(this.fs, 'assignments', `${schoolId}_${classId}`), {
      schoolId,
      classId,
      teacherId,
      teacherName,
    });
  }

  clearClassTeacherFor(schoolId: string, classId: string) {
    if (!this.fs) return;
    void deleteDoc(doc(this.fs, 'assignments', `${schoolId}_${classId}`));
  }

  // ---- head master: create school users ----

  /**
   * Creates a Firebase Auth account without logging the head master out, via a
   * throwaway secondary Firebase app, then writes the users/{uid} profile.
   */
  async createSchoolUser(input: {
    name: string;
    email: string;
    password: string;
    role: Exclude<Role, 'superadmin' | 'headmaster'>;
    phone?: string;
    classId?: string;
    studentId?: string;
  }): Promise<string | null> {
    const me = this.auth.user();
    if (!this.fs || !me?.schoolId) return 'Not connected to a school.';

    const secondary = initializeApp(environment.firebase, `user-creation-${Date.now()}`);
    try {
      const secAuth = getAuth(secondary);
      const cred = await createUserWithEmailAndPassword(secAuth, input.email.trim().toLowerCase(), input.password);
      const uid = cred.user.uid;
      await signOut(secAuth);
      await setDoc(doc(this.fs, 'users', uid), {
        role: input.role,
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone ?? '',
        schoolId: me.schoolId,
        studentId: input.studentId ?? null,
        classId: input.classId ?? null,
      });
      return null;
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? '';
      if (code === 'auth/email-already-in-use') return 'This email already has an account.';
      if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
      if (code === 'auth/invalid-email') return 'Invalid email address.';
      return 'Could not create the user. Please try again.';
    } finally {
      void deleteApp(secondary);
    }
  }
}
