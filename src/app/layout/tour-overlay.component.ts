import { Component, inject } from '@angular/core';
import { TourService } from '../core/tour.service';
import { TPipe } from '../core/translate.service';

@Component({
  selector: 'app-tour-overlay',
  imports: [TPipe],
  template: `
    @if (tour.active() && tour.current(); as step) {
      <div class="fixed inset-x-0 bottom-24 lg:bottom-8 z-[90] flex justify-center px-3 pointer-events-none">
        <div class="pointer-events-auto bg-white rounded-2xl shadow-2xl border-2 border-primary w-full max-w-md p-4 animate-[fadeIn_.2s_ease]">
          <div class="flex items-center justify-between mb-1">
            <div class="text-[11px] font-bold text-primary uppercase tracking-wide">
              {{ 'tour' | t }} · {{ tour.index() + 1 }}/{{ tour.total() }}
            </div>
            <button class="text-muted hover:text-ink cursor-pointer text-sm font-semibold" (click)="tour.stop()">✕ {{ 'tourSkip' | t }}</button>
          </div>
          <div class="font-bold text-[16px] mb-1">{{ step.title }}</div>
          <p class="text-[13px] text-muted leading-relaxed mb-3">{{ step.desc }}</p>
          <div class="flex gap-2">
            @if (tour.index() > 0) {
              <button class="rounded-xl border border-line text-muted font-semibold px-4 py-2 text-[13px]" (click)="tour.prev()">← {{ 'tourPrev' | t }}</button>
            }
            <button class="flex-1 justify-center btn-blue" (click)="tour.next()">
              {{ tour.isLast() ? ('tourFinish' | t) : ('tourNext' | t) + ' →' }}
            </button>
          </div>
          <!-- progress -->
          <div class="flex gap-1 mt-3">
            @for (i of dots(); track i) {
              <div class="flex-1 h-1 rounded-full" [class]="i <= tour.index() ? 'bg-primary' : 'bg-line'"></div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class TourOverlayComponent {
  tour = inject(TourService);
  dots() {
    return Array.from({ length: this.tour.total() }, (_, i) => i);
  }
}
