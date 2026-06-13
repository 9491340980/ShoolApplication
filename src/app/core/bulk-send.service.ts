import { computed, Injectable, signal } from '@angular/core';

export interface BulkItem {
  name: string;
  link: string; // pre-built wa.me link
}

/**
 * Guided "Send All" over WhatsApp. Free wa.me links can't bulk-send silently
 * (that needs the paid Business API), so this walks the user through one parent
 * at a time: each "Open WhatsApp" tap is a real user gesture, so popups aren't
 * blocked, and the queue auto-advances.
 */
@Injectable({ providedIn: 'root' })
export class BulkSendService {
  private queue = signal<BulkItem[]>([]);
  private idx = signal(0);

  readonly active = computed(() => this.queue().length > 0);
  readonly total = computed(() => this.queue().length);
  readonly position = computed(() => this.idx());
  readonly current = computed<BulkItem | null>(() => this.queue()[this.idx()] ?? null);
  readonly done = computed(() => this.active() && this.idx() >= this.queue().length);

  start(items: BulkItem[]) {
    if (!items.length) return;
    this.queue.set(items);
    this.idx.set(0);
  }

  /** Open the current parent's WhatsApp and advance to the next. */
  openCurrentAndNext() {
    const it = this.current();
    if (it) window.open(it.link, '_blank');
    this.idx.update((i) => i + 1);
  }

  skip() {
    this.idx.update((i) => i + 1);
  }

  close() {
    this.queue.set([]);
    this.idx.set(0);
  }
}
