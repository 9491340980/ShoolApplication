import { computed, Injectable, signal } from '@angular/core';

export interface BulkItem {
  name: string;
  link: string; // pre-built wa.me / sms: link
}

const BATCH_SIZE = 45;

/**
 * Guided "Send All" over WhatsApp/SMS, processed in batches of 45.
 * Free wa.me/sms links can't bulk-send silently (that needs the paid API), so
 * this walks the user through one recipient at a time. To keep large audiences
 * manageable, recipients are split into batches of 45 — finish one batch, then
 * start the next.
 */
@Injectable({ providedIn: 'root' })
export class BulkSendService {
  private all = signal<BulkItem[]>([]);
  private batch = signal(0); // 0-based batch index
  private idx = signal(0); // position within the current batch

  readonly active = computed(() => this.all().length > 0);
  readonly totalAll = computed(() => this.all().length);
  readonly batchCount = computed(() => Math.ceil(this.all().length / BATCH_SIZE));
  readonly batchNo = computed(() => this.batch() + 1);

  private batchItems = computed(() => {
    const start = this.batch() * BATCH_SIZE;
    return this.all().slice(start, start + BATCH_SIZE);
  });
  readonly batchTotal = computed(() => this.batchItems().length);
  readonly position = computed(() => this.idx());
  readonly current = computed<BulkItem | null>(() => this.batchItems()[this.idx()] ?? null);

  /** Reached the end of the current batch. */
  readonly batchDone = computed(() => this.active() && this.idx() >= this.batchItems().length);
  readonly hasMoreBatches = computed(() => this.batch() < this.batchCount() - 1);
  /** Done with every batch. */
  readonly allDone = computed(() => this.batchDone() && !this.hasMoreBatches());
  /** How many recipients remain after the current batch. */
  readonly remainingAfterBatch = computed(() =>
    Math.max(0, this.all().length - (this.batch() + 1) * BATCH_SIZE),
  );

  start(items: BulkItem[]) {
    if (!items.length) return;
    this.all.set(items);
    this.batch.set(0);
    this.idx.set(0);
  }

  /** Open the current recipient's WhatsApp/SMS and advance within the batch. */
  openCurrentAndNext() {
    const it = this.current();
    if (it) window.open(it.link, '_blank');
    this.idx.update((i) => i + 1);
  }

  skip() {
    this.idx.update((i) => i + 1);
  }

  /** Move on to the next batch of 45. */
  nextBatch() {
    this.batch.update((b) => b + 1);
    this.idx.set(0);
  }

  close() {
    this.all.set([]);
    this.batch.set(0);
    this.idx.set(0);
  }
}
