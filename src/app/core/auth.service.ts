import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  Auth,
  GoogleAuthProvider,
  User,
  getRedirectResult,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
} from '@angular/fire/auth';
import { Firestore, collection, doc, getDoc, getDocs, limit, query, setDoc, where } from '@angular/fire/firestore';
import { environment, firebaseEnabled } from '../../environments/environment';
import { DEMO_PASSWORD, DEMO_USERS } from './demo-data';
import { AppUser, Role, School } from './models';

const SESSION_KEY = 'vidyasetu-session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  private fbAuth = firebaseEnabled() ? inject(Auth) : null;
  private fs = firebaseEnabled() ? inject(Firestore) : null;

  readonly user = signal<AppUser | null>(this.restore());
  readonly role = computed<Role | null>(() => this.user()?.role ?? null);
  /** True while a Google redirect sign-in is being completed on app load. */
  readonly resolvingRedirect = signal(false);

  constructor() {
    // Complete a Google sign-in that used the redirect flow (mobile / WebView).
    if (this.fbAuth) {
      this.resolvingRedirect.set(true);
      getRedirectResult(this.fbAuth)
        .then((res) => {
          if (res?.user) return this.handleGoogleUser(res.user);
          return null;
        })
        .catch(() => null)
        .finally(() => this.resolvingRedirect.set(false));
    }
  }


  private restore(): AppUser | null {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  }

  /**
   * One-click demo login. With Firebase connected it signs into the real demo
   * account (so Firestore reads work); falls back to a local session if the
   * account doesn't exist yet — demos never break.
   */
  async loginDemo(role: Exclude<Role, 'superadmin'>) {
    const demoUser = DEMO_USERS[role];
    if (this.fbAuth) {
      try {
        const cred = await signInWithEmailAndPassword(this.fbAuth, demoUser.email, DEMO_PASSWORD);
        await this.ensureUserDoc(cred.user.uid, demoUser);
      } catch {
        /* demo account missing in Firebase — continue with local session */
      }
    }
    this.setSession(demoUser);
    this.router.navigateByUrl('/dashboard');
  }

  /**
   * Google sign-in for school owners and the super admin.
   * - Super admin emails (environment.superAdminEmails) land on /admin.
   * - A Gmail registered as a school's adminEmail becomes that school's Head Master.
   */
  async loginWithGoogle(): Promise<string | null> {
    if (!this.fbAuth) return 'Google sign-in needs Firebase connected.';
    const provider = new GoogleAuthProvider();
    try {
      const cred = await signInWithPopup(this.fbAuth, provider);
      return this.handleGoogleUser(cred.user);
    } catch {
      return 'Google sign-in was cancelled or blocked. On the mobile app, native Google sign-in is required.';
    }
  }

  /** Route a signed-in Google user to super admin / Head Master based on their email. */
  private async handleGoogleUser(user: User): Promise<string | null> {
    if (!this.fbAuth) return null;
    const uid = user.uid;
    const email = (user.email ?? '').toLowerCase();
    const displayName = user.displayName ?? email;

    if (environment.superAdminEmails.includes(email)) {
      const profile: AppUser = { id: uid, role: 'superadmin', name: displayName, phone: '', email };
      await this.ensureUserDoc(uid, profile);
      this.setSession(profile);
      this.router.navigateByUrl('/admin');
      return null;
    }

    const existing = await this.loadUserDoc(uid);
    if (existing) {
      if (existing.disabled) {
        void signOut(this.fbAuth);
        return 'Your access has been disabled. Please contact your Head Master.';
      }
      this.setSession(existing);
      this.router.navigateByUrl('/dashboard');
      return null;
    }

    const school = await this.findSchoolByAdminEmail(email);
    if (!school) {
      void signOut(this.fbAuth);
      return 'No school is registered for this Google account. Please contact VidyaSetu support.';
    }
    if (!school.active) {
      void signOut(this.fbAuth);
      return 'This school account is deactivated. Please contact VidyaSetu support.';
    }
    const profile: AppUser = {
      id: uid,
      role: 'headmaster',
      name: displayName,
      phone: school.phone,
      email,
      schoolId: school.id,
    };
    await this.ensureUserDoc(uid, profile);
    this.setSession(profile);
    this.router.navigateByUrl('/dashboard');
    return null;
  }

  private async findSchoolByAdminEmail(email: string): Promise<School | null> {
    if (!this.fs) return null;
    try {
      const snap = await getDocs(
        query(collection(this.fs, 'schools'), where('adminEmail', '==', email), limit(1)),
      );
      if (snap.empty) return null;
      const d = snap.docs[0];
      return { ...(d.data() as Omit<School, 'id'>), id: d.id };
    } catch {
      return null;
    }
  }

  /** Email/phone + password login. Uses Firebase when configured, demo accounts otherwise. */
  async loginWithPassword(identifier: string, password: string): Promise<string | null> {
    const id = identifier.trim().toLowerCase();
    const demoUser = Object.values(DEMO_USERS).find((u) => u.email === id || u.phone === id);

    if (this.fbAuth) {
      const email = demoUser?.email ?? id;
      let uid: string;
      try {
        const cred = await signInWithEmailAndPassword(this.fbAuth, email, password);
        uid = cred.user.uid;
      } catch {
        return 'Invalid credentials. Please check and try again.';
      }
      const profile = demoUser ?? (await this.loadUserDoc(uid));
      if (!profile) {
        void signOut(this.fbAuth);
        return 'This account has no school profile yet. Ask your Head Master to add you.';
      }
      if (profile.disabled) {
        void signOut(this.fbAuth);
        return 'Your access has been disabled. Please contact your Head Master.';
      }
      await this.ensureUserDoc(uid, profile);
      this.setSession(profile);
      this.router.navigateByUrl('/dashboard');
      return null;
    }

    if (demoUser && password === DEMO_PASSWORD) {
      this.setSession(demoUser);
      this.router.navigateByUrl('/dashboard');
      return null;
    }
    return `Invalid credentials. Demo accounts use password "${DEMO_PASSWORD}".`;
  }

  /** Security rules read the role from users/{uid}, so the doc must exist before any write. */
  private async ensureUserDoc(uid: string, profile: AppUser) {
    if (!this.fs) return;
    try {
      await setDoc(
        doc(this.fs, 'users', uid),
        {
          role: profile.role,
          name: profile.name,
          phone: profile.phone,
          email: profile.email,
          schoolId: profile.schoolId ?? null,
          studentId: profile.studentId ?? null,
          classId: profile.classId ?? null,
        },
        { merge: true },
      );
    } catch {
      /* rules may forbid this for non-self docs — safe to ignore */
    }
  }

  private async loadUserDoc(uid: string): Promise<AppUser | null> {
    if (!this.fs) return null;
    try {
      const snap = await getDoc(doc(this.fs, 'users', uid));
      if (!snap.exists()) return null;
      const d = snap.data();
      return {
        id: uid,
        role: d['role'],
        name: d['name'],
        phone: d['phone'] ?? '',
        email: d['email'] ?? '',
        schoolId: d['schoolId'] ?? undefined,
        studentId: d['studentId'] ?? undefined,
        classId: d['classId'] ?? undefined,
        disabled: d['disabled'] ?? false,
      };
    } catch {
      return null;
    }
  }

  /** Send a Firebase password-reset email (works for accounts with a real inbox). */
  async resetPassword(email: string): Promise<string | null> {
    if (!this.fbAuth) return 'Password reset needs Firebase connected.';
    const addr = email.trim().toLowerCase();
    if (!addr) return 'Enter your email first.';
    try {
      await sendPasswordResetEmail(this.fbAuth, addr);
      return null;
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code === 'auth/invalid-email') return 'Enter a valid email address.';
      if (code === 'auth/user-not-found') return 'No account found with that email.';
      return 'Could not send the reset email. Please try again.';
    }
  }

  async changePassword(newPassword: string): Promise<string | null> {
    if (this.fbAuth?.currentUser) {
      try {
        await updatePassword(this.fbAuth.currentUser, newPassword);
        return null;
      } catch {
        return 'Could not update password. Please re-login and try again.';
      }
    }
    return null; // demo mode: pretend success
  }

  logout() {
    if (this.fbAuth) void signOut(this.fbAuth);
    localStorage.removeItem(SESSION_KEY);
    this.user.set(null);
    this.router.navigateByUrl('/login');
  }

  private setSession(user: AppUser) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    this.user.set(user);
  }
}
