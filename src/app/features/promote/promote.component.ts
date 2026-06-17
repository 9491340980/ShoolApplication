import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/data.service';
import { TPipe, TranslateService } from '../../core/translate.service';

const NEXT: Record<string, string> = {
  '6A': '7A', '7A': '8A', '8A': '9A', '8B': '9B', '9A': '10A', '9B': '10B', '10A': 'PASSED', '10B': 'PASSED',
};

interface PlanRow {
  from: string;
  to: string;
  count: number;
}

@Component({
  selector: 'app-promote',
  imports: [FormsModule, TPipe],
  templateUrl: './promote.component.html',
})
export class PromoteComponent {
  data = inject(DataService);
  private i18n = inject(TranslateService);

  classes = computed(() => this.data.schoolClasses());
  /** Dropdown options: keep (same class), any class, or graduate. */
  targets = computed(() => [...this.data.schoolClasses(), 'PASSED']);
  busy = signal(false);
  doneMsg = signal<string | null>(null);

  /** Explicit per-class target overrides; otherwise the natural next class. */
  private overrides = signal<Record<string, string>>({});

  nextOf(c: string): string {
    return this.data.schoolClasses().includes(NEXT[c]) || NEXT[c] === 'PASSED' ? NEXT[c] : c;
  }
  targetOf(c: string): string {
    return this.overrides()[c] ?? this.nextOf(c);
  }
  setTarget(from: string, to: string) {
    this.overrides.update((t) => ({ ...t, [from]: to }));
  }

  /** The full plan: every class → its chosen target. */
  plan = computed<PlanRow[]>(() =>
    this.classes().map((c) => ({ from: c, to: this.targetOf(c), count: this.data.studentsOf(c).length })),
  );

  /** Classes that will actually feed a given target (with students). */
  sourcesOf(target: string): string[] {
    return this.plan().filter((p) => p.to === target && p.count > 0).map((p) => p.from);
  }
  /** Resulting size of an active class after the plan runs. */
  resultCount(c: string): number {
    return this.plan().filter((p) => p.to === c).reduce((a, p) => a + p.count, 0);
  }
  graduatingCount = computed(() => this.plan().filter((p) => p.to === 'PASSED').reduce((a, p) => a + p.count, 0));
  movingCount = computed(() => this.plan().filter((p) => p.to !== p.from).reduce((a, p) => a + p.count, 0));

  /** Targets fed by more than one class — a likely mistake (two cohorts merge). */
  warnings = computed(() =>
    this.classes()
      .map((c) => ({ target: c, sources: this.sourcesOf(c) }))
      .filter((w) => w.sources.length > 1),
  );

  resetPlan() {
    this.overrides.set({});
  }

  async promoteAll() {
    if (this.movingCount() === 0) return;
    const lines = this.plan()
      .filter((p) => p.to !== p.from && p.count > 0)
      .map((p) => `${p.from} → ${p.to === 'PASSED' ? this.i18n.t('graduate') : p.to}  (${p.count})`);
    const warn = this.warnings().length ? `\n\n⚠️ ${this.i18n.t('mergeWarnConfirm')}` : '';
    if (!confirm(`${this.i18n.t('promoteConfirm')}\n\n${lines.join('\n')}${warn}`)) return;
    this.busy.set(true);
    const { moved, graduated } = await this.data.promoteAll(this.plan());
    this.busy.set(false);
    this.resetPlan();
    this.doneMsg.set(`✓ ${this.i18n.t('promoted')}: ${moved}${graduated ? ` · ${this.i18n.t('graduate')}: ${graduated}` : ''}`);
    setTimeout(() => this.doneMsg.set(null), 4000);
  }
}
