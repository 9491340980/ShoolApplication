import { Component, inject } from '@angular/core';
import { ShareService } from '../core/share.service';
import { TPipe } from '../core/translate.service';

/**
 * The "how do you want to send?" sheet shown when any parent-facing WhatsApp
 * button is tapped: existing text message, or a private parent-view link.
 */
@Component({
  selector: 'app-share-chooser',
  imports: [TPipe],
  template: `
    @if (share.chooser(); as c) {
      <div class="fixed inset-0 bg-black/50 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4" (click)="share.closeChooser()">
        <div class="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5" (click)="$event.stopPropagation()">
          <div class="text-center mb-4">
            <div class="text-3xl mb-1">🟢</div>
            <div class="font-bold text-[15px]">{{ 'sendToParent' | t }}</div>
            <div class="text-xs text-muted">{{ c.student.name }}</div>
          </div>

          <button class="w-full flex items-center gap-3 border border-line rounded-xl px-4 py-3 mb-2.5 text-left hover:border-primary disabled:opacity-50" [disabled]="share.busy()" (click)="share.sendExisting()">
            <span class="text-2xl">💬</span>
            <span>
              <span class="block font-semibold text-[14px]">{{ 'sendMessageOpt' | t }}</span>
              <span class="block text-[11px] text-muted">{{ 'sendMessageOptHint' | t }}</span>
            </span>
          </button>

          <button class="w-full flex items-center gap-3 border-2 border-primary bg-primary-light rounded-xl px-4 py-3 text-left hover:opacity-90 disabled:opacity-50" [disabled]="share.busy()" (click)="share.sendLink()">
            <span class="text-2xl">🔗</span>
            <span>
              <span class="block font-semibold text-[14px] text-primary">{{ share.busy() ? ('pleaseWait' | t) : ('sendLinkOpt' | t) }}</span>
              <span class="block text-[11px] text-muted">{{ 'sendLinkOptHint' | t }}</span>
            </span>
          </button>

          <button class="w-full text-center text-muted text-sm font-semibold mt-3 py-1.5" (click)="share.closeChooser()">{{ 'cancel' | t }}</button>
        </div>
      </div>
    }
  `,
})
export class ShareChooserComponent {
  share = inject(ShareService);
}
