import { Component, computed, effect, inject, signal } from '@angular/core';
import { AttendanceHistoryService } from '../core/attendance-history.service';
import { TPipe } from '../core/translate.service';

interface DayCell {
  day: number;
  date: string;
  status: 'present' | 'absent' | null;
}

/** Month calendar of a person's attendance: green = present, red = absent. */
@Component({
  selector: 'app-attendance-history',
  imports: [TPipe],
  template: `
    @if (hist.state(); as s) {
      <div class="fixed inset-0 bg-black/50 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4" (click)="hist.close()">
        <div class="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between px-5 py-4 border-b border-line">
            <div>
              <div class="font-bold text-[15px]">📅 {{ 'attendanceHistory' | t }}</div>
              <div class="text-xs text-muted">{{ s.title }}</div>
            </div>
            <button class="text-muted hover:text-ink cursor-pointer text-xl" (click)="hist.close()">✕</button>
          </div>

          <div class="p-5">
            <!-- month nav -->
            <div class="flex items-center justify-between mb-3">
              <button class="w-9 h-9 rounded-lg border border-line font-bold text-lg hover:border-primary" (click)="shift(-1)">‹</button>
              <div class="font-bold text-[15px]">{{ monthLabel() }}</div>
              <button class="w-9 h-9 rounded-lg border border-line font-bold text-lg hover:border-primary disabled:opacity-30" [disabled]="atCurrentMonth()" (click)="shift(1)">›</button>
            </div>

            <!-- weekday headers -->
            <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted mb-1">
              @for (d of weekdays; track d) { <div>{{ d }}</div> }
            </div>
            <!-- day grid -->
            <div class="grid grid-cols-7 gap-1">
              @for (blank of leading(); track $index) { <div></div> }
              @for (c of cells(); track c.date) {
                <div class="aspect-square rounded-lg flex items-center justify-center text-[13px] font-semibold"
                     [class]="c.status === 'present' ? 'bg-success text-white' : c.status === 'absent' ? 'bg-danger text-white' : 'bg-page text-muted'">
                  {{ c.day }}
                </div>
              }
            </div>

            <!-- legend + totals -->
            <div class="flex items-center justify-center gap-4 mt-4 text-[12px]">
              <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-success inline-block"></span> {{ 'present' | t }}: <b>{{ presentCount() }}</b></span>
              <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-danger inline-block"></span> {{ 'absent' | t }}: <b>{{ absentCount() }}</b></span>
            </div>
            @if (presentCount() + absentCount() === 0) {
              <div class="text-center text-muted text-[12px] mt-2">— {{ 'noAttendanceMonth' | t }}</div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class AttendanceHistoryComponent {
  hist = inject(AttendanceHistoryService);
  weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  /** Offset in months from the current month (0 = this month, negative = past). */
  private offset = signal(0);
  private today = new Date();

  /** Jump back to the current month each time a new person's history is opened. */
  private resetOnOpen = effect(() => {
    this.hist.state();
    this.offset.set(0);
  });

  private view = computed(() => {
    const d = new Date(this.today.getFullYear(), this.today.getMonth() + this.offset(), 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  monthLabel = computed(() => {
    const { y, m } = this.view();
    return new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  });
  atCurrentMonth = computed(() => this.offset() >= 0);
  leading = computed(() => {
    const { y, m } = this.view();
    return Array(new Date(y, m, 1).getDay()).fill(0);
  });
  cells = computed<DayCell[]>(() => {
    const { y, m } = this.view();
    const map = this.hist.state()?.map ?? {};
    const days = new Date(y, m + 1, 0).getDate();
    const out: DayCell[] = [];
    for (let day = 1; day <= days; day++) {
      const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      out.push({ day, date, status: map[date] ?? null });
    }
    return out;
  });
  presentCount = computed(() => this.cells().filter((c) => c.status === 'present').length);
  absentCount = computed(() => this.cells().filter((c) => c.status === 'absent').length);

  shift(by: number) {
    this.offset.update((o) => Math.min(0, o + by));
  }
}
