import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/data.service';
import { CLASSES } from '../../core/models';
import { TPipe, TranslateService } from '../../core/translate.service';

const NEXT: Record<string, string> = {
  '6A': '7A',
  '7A': '8A',
  '8A': '9A',
  '8B': '9B',
  '9A': '10A',
  '9B': '10B',
  '10A': 'PASSED',
  '10B': 'PASSED',
};

@Component({
  selector: 'app-promote',
  imports: [FormsModule, TPipe],
  templateUrl: './promote.component.html',
})
export class PromoteComponent {
  data = inject(DataService);
  private i18n = inject(TranslateService);

  classes = CLASSES;
  targets = [...CLASSES, 'PASSED'];
  busy = signal(false);
  doneMsg = signal<string | null>(null);

  /** Per-class target selection (defaults to the natural next class). */
  target = signal<Record<string, string>>(Object.fromEntries(CLASSES.map((c) => [c, NEXT[c] ?? c])));

  rows = computed(() =>
    this.classes.map((c) => ({ classId: c, count: this.data.studentsOf(c).length })),
  );

  setTarget(from: string, to: string) {
    this.target.update((t) => ({ ...t, [from]: to }));
  }

  async promote(from: string, count: number) {
    const to = this.target()[from];
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
