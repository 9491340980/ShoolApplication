import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, signInWithEmailAndPassword, signOut, updatePassword } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { firebaseEnabled } from '../../environments/environment';
import { DEMO_PASSWORD, DEMO_USERS } from './demo-data';
import { AppUser, Role } from './models';

const SESSION_KEY = 'vidyasetu-session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  private fbAuth = firebaseEnabled() ? inject(Auth) : null;
  private fs = firebaseEnabled() ? inject(Firestore) : null;

  readonly user = signal<AppUser | null>(this.restore());
  readonly role = computed<Role | null>(() => this.user()?.role ?? null);

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
  async loginDemo(role: Role) {
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
      const profile = demoUser ?? (await this.loadUserDoc(uid)) ?? {
        id: uid,
        role: 'headmaster' as Role,
        name: email,
        phone: '',
        email,
      };
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
        studentId: d['studentId'] ?? undefined,
        classId: d['classId'] ?? undefined,
      };
    } catch {
      return null;
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
