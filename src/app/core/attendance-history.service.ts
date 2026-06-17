import { Injectable, signal } from '@angular/core';

export type AttMap = Record<string, 'present' | 'absent'>;

/** Drives the shared month-wise attendance calendar shown for a student or teacher. */
@Injectable({ providedIn: 'root' })
export class AttendanceHistoryService {
  readonly state = signal<{ title: string; map: AttMap } | null>(null);

  open(title: string, map: AttMap) {
    this.state.set({ title, map });
  }
  close() {
    this.state.set(null);
  }
}
