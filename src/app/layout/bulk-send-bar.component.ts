import { Component, inject } from '@angular/core';
import { BulkSendService } from '../core/bulk-send.service';
import { TPipe } from '../core/translate.service';

@Component({
  selector: 'app-bulk-send-bar',
  imports: [TPipe],
  template: `
    @if (bulk.active()) {
      <div class="fixed bottom-20 lg:bottom-6 inset-x-3 lg:left-auto lg:right-6 lg:w-96 z-[80] bg-white rounded-2xl shadow-2xl border border-line p-4">
        @if (bulk.allDone()) {
          <div class="text-center">
            <div class="text-3xl mb-1">✅</div>
            <div class="font-bold text-[14px] mb-3">{{ 'bulkAllSent' | t }} ({{ bulk.totalAll() }})</div>
            <button class="btn-blue w-full justify-center" (click)="bulk.close()">{{ 'bulkDone' | t }}</button>
          </div>
        } @else if (bulk.batchDone()) {
          <!-- finished this batch of 45, more remain -->
          <div class="text-center">
            <div class="text-2xl mb-1">✅</div>
            <div class="font-bold text-[14px]">{{ 'batchDone' | t }} {{ bulk.batchNo() }}/{{ bulk.batchCount() }}</div>
            <p class="text-[12px] text-muted mb-3">{{ bulk.remainingAfterBatch() }} {{ 'remaining' | t }}</p>
            <div class="flex gap-2">
              <button class="flex-1 justify-center btn-blue" (click)="bulk.nextBatch()">⏭️ {{ 'nextBatch' | t }}</button>
              <button class="rounded-xl border border-line text-muted font-semibold px-4" (click)="bulk.close()">{{ 'bulkSkip' | t }}</button>
            </div>
          </div>
        } @else {
          <div class="flex items-center justify-between mb-1">
            <div class="text-[11px] font-bold text-muted uppercase tracking-wide">
              {{ 'sendingTo' | t }} {{ bulk.position() + 1 }}/{{ bulk.batchTotal() }}
              @if (bulk.batchCount() > 1) { <span class="text-primary"> · {{ 'batch' | t }} {{ bulk.batchNo() }}/{{ bulk.batchCount() }}</span> }
            </div>
            <button class="text-muted hover:text-ink cursor-pointer text-sm" (click)="bulk.close()">✕</button>
          </div>
          <div class="font-bold text-[15px] mb-1">{{ bulk.current()?.name }}</div>
          <p class="text-[11px] text-muted mb-3">{{ 'bulkHint' | t }}</p>
          <div class="flex gap-2">
            <button class="flex-1 justify-center rounded-xl bg-[#25D366] text-white font-semibold py-2.5 inline-flex items-center gap-1.5"
                    (click)="bulk.openCurrentAndNext()">🟢 {{ 'bulkOpen' | t }}</button>
            <button class="rounded-xl border border-line text-muted font-semibold px-4 py-2.5" (click)="bulk.skip()">{{ 'bulkSkip' | t }}</button>
          </div>
        }
      </div>
    }
  `,
})
export class BulkSendBarComponent {
  bulk = inject(BulkSendService);
}
