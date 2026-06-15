import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/data.service';
import { TPipe, TranslateService } from '../../core/translate.service';

const NEXT: Record<string, string> = {
  '6A': '7A', '7A': '8A', '8A': '9A', '8B': '9B', '9A': '10A', '9B': '10B', '10A': 'PASSED', '10B': 'PASSED',
};

@Component({
  selector: 'app-promote',
  imports: [FormsModule, TPipe],
  templateUrl: './promote.component.html',
})
export class PromoteComponent {
  data = inject(DataService);
  private i18n = inject(TranslateService);

  classes = computed(() => this.data.schoolClasses());
  targets = computed(() => [...this.data.schoolClasses(), 'PASSED']);
  busy = signal(false);
  doneMsg = signal<string | null>(null);

  /** Explicit per-class target overrides; otherwise the natural next class. */
  private overrides = signal<Record<string, string>>({});

  /** Suggested next class (mapped default, else same class). */
  nextOf(c: string): string {
    return NEXT[c] ?? c;
  }
  targetOf(c: string): string {
    return this.overrides()[c] ?? this.nextOf(c);
  }

  rows = computed(() =>
    this.classes().map((c) => ({ classId: c, count: this.data.studentsOf(c).length })),
  );

  setTarget(from: string, to: string) {
    this.overrides.update((t) => ({ ...t, [from]: to }));
  }

  async promote(from: string, count: number) {
    const to = this.targetOf(from);
    if (!to || to === from) return;
    const label = to === 'PASSED' ? this.i18n.t('graduate') : to;
    if (!confirm(`${this.i18n.t('promoteConfirm')}\n\n${from} → ${label}  (${count})`)) return;
    this.busy.set(true);
    const n = await this.data.promoteClass(from, to);
    this.busy.set(false);
    this.doneMsg.set(`✓ ${from} → ${label}: ${n}`);
    setTimeout(() => this.doneMsg.set(null), 3000);
  }
}
