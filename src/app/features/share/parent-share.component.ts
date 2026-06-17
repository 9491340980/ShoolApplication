import { Component, computed, inject, signal } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { ActivatedRoute } from '@angular/router';
import { firebaseEnabled } from '../../../environments/environment';
import { ShareService } from '../../core/share.service';
import { ShareSnapshot } from '../../core/models';
import { TPipe, TranslateService } from '../../core/translate.service';

/**
 * Public, login-free view of one child for parents (`/p/:token`).
 * Reads a single read-only snapshot doc by its unguessable token.
 */
@Component({
  selector: 'app-parent-share',
  imports: [TPipe],
  template: `
    <div class="min-h-screen bg-page">
      <div class="max-w-xl mx-auto p-4 sm:p-6">
        @if (loading()) {
          <div class="text-center text-muted py-20">⏳ {{ 'loading' | t }}…</div>
        } @else if (!snap()) {
          <div class="card text-center py-16">
            <div class="text-4xl mb-3">🔌</div>
            <div class="font-bold text-lg mb-1">{{ 'linkInvalid' | t }}</div>
            <div class="text-muted text-sm">{{ 'linkInvalidHint' | t }}</div>
          </div>
        } @else {
          @let s = snap()!;
          <!-- header -->
          <div class="flex items-center justify-between mb-3">
            <span class="text-[11px] font-semibold text-muted">🔒 {{ 'readOnlyView' | t }}</span>
            <button class="bg-white border border-line rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer hover:border-primary" (click)="i18n.toggle()">
              {{ i18n.lang() === 'te' ? 'EN' : 'తెలుగు' }}
            </button>
          </div>

          <div class="card text-center !pb-4 mb-4">
            @if (s.logo) {
              <img [src]="s.logo" class="w-16 h-16 object-contain mx-auto mb-1.5" alt="logo" />
            }
            <div class="font-display text-xl font-extrabold text-primary">{{ s.schoolName }}</div>
            <div class="text-2xl font-extrabold mt-2">{{ s.studentName }}</div>
            <div class="text-sm text-muted">{{ 'class' | t }} {{ s.classId }} · {{ 'roll' | t }} {{ s.roll }}</div>
          </div>

          <!-- attendance -->
          <div class="card mb-4">
            <div class="card-title">📅 {{ 'attendance' | t }}</div>
            <div class="grid grid-cols-3 gap-2 text-center mb-2">
              <div class="bg-primary-light rounded-lg py-2">
                <div class="font-extrabold text-primary text-lg">{{ s.attendance.pct === null ? '—' : s.attendance.pct + '%' }}</div>
                <div class="text-[10px] text-muted">{{ 'attendance' | t }}</div>
              </div>
              <div class="bg-success-light rounded-lg py-2">
                <div class="font-extrabold text-success text-lg">{{ s.attendance.present }}</div>
                <div class="text-[10px] text-muted">{{ 'present' | t }}</div>
              </div>
              <div class="bg-danger-light rounded-lg py-2">
                <div class="font-extrabold text-danger text-lg">{{ s.attendance.absent }}</div>
                <div class="text-[10px] text-muted">{{ 'absent' | t }}</div>
              </div>
            </div>
            @if (s.attendance.byMonth.length) {
              <div class="flex items-end gap-1.5 h-20 mt-3">
                @for (m of s.attendance.byMonth; track m.month) {
                  @let tot = m.present + m.absent;
                  <div class="flex-1 flex flex-col items-center gap-1">
                    <div class="w-full bg-page rounded-t flex items-end" style="height:60px">
                      <div class="w-full bg-success rounded-t" [style.height.%]="tot ? (m.present / tot) * 100 : 0"></div>
                    </div>
                    <span class="text-[9px] text-muted">{{ m.month.slice(5) }}</span>
                  </div>
                }
              </div>
            }
          </div>

          <!-- fees -->
          @if (s.fees.length) {
            <div class="card mb-4">
              <div class="card-title">💰 {{ 'feeDetails' | t }}</div>
              <div class="grid grid-cols-3 gap-2 text-center mb-3">
                <div><div class="font-extrabold text-primary">₹{{ s.feeTotal }}</div><div class="text-[10px] text-muted">{{ 'totalFee' | t }}</div></div>
                <div><div class="font-extrabold text-success">₹{{ s.feePaid }}</div><div class="text-[10px] text-muted">{{ 'collected' | t }}</div></div>
                <div><div class="font-extrabold text-danger">₹{{ s.feeBalance }}</div><div class="text-[10px] text-muted">{{ 'pending' | t }}</div></div>
              </div>
              @for (f of s.fees; track f.label) {
                <div class="flex justify-between items-center py-2 border-t border-line text-[13px]">
                  <span>{{ f.label }}</span>
                  <span class="text-muted">₹{{ f.paid }} / ₹{{ f.amount }}
                    @if (f.balance > 0) { <span class="text-danger font-semibold">· ⏳ ₹{{ f.balance }}</span> }
                    @else { <span class="text-success font-semibold">✓</span> }
                  </span>
                </div>
              }
            </div>
          }

          <!-- marks -->
          @for (ex of s.exams; track ex.label) {
            <div class="card mb-4">
              <div class="card-title">📋 {{ ex.label }} — {{ ex.pct }}%</div>
              <table class="w-full text-[13px]">
                <tbody>
                  @for (sub of ex.subjects; track sub.subject) {
                    <tr class="border-t border-line">
                      <td class="py-1.5">{{ sub.subject }}</td>
                      <td class="py-1.5 text-right font-semibold">{{ sub.score }} / {{ sub.max }}</td>
                    </tr>
                  }
                  <tr class="border-t-2 border-primary font-bold">
                    <td class="py-1.5">{{ 'total' | t }}</td>
                    <td class="py-1.5 text-right">{{ ex.total }} / {{ ex.max }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          }

          <div class="text-center text-[11px] text-muted mt-5 mb-8">
            {{ 'lastUpdated' | t }}: {{ s.updatedAt.slice(0, 10) }} · {{ 'poweredBy' | t }} VidyaSetu
          </div>
        }
      </div>
    </div>
  `,
})
export class ParentShareComponent {
  private route = inject(ActivatedRoute);
  private share = inject(ShareService);
  private fs = firebaseEnabled() ? inject(Firestore) : null;
  i18n = inject(TranslateService);

  loading = signal(true);
  snap = signal<ShareSnapshot | null>(null);

  constructor() {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    void this.load(token);
  }

  private async load(token: string) {
    try {
      if (this.fs) {
        const d = await getDoc(doc(this.fs, 'shares', token));
        this.snap.set(d.exists() ? (d.data() as ShareSnapshot) : null);
      } else {
        this.snap.set(this.share.readLocal(token));
      }
    } catch {
      this.snap.set(null);
    } finally {
      this.loading.set(false);
    }
  }
}
