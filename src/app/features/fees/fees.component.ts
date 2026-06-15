import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { FeeItem, Student } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { TPipe } from '../../core/translate.service';

@Component({
  selector: 'app-fees',
  imports: [FormsModule, TPipe],
  templateUrl: './fees.component.html',
})
export class FeesComponent {
  auth = inject(AuthService);
  data = inject(DataService);
  notify = inject(NotifyService);

  isStaff = computed(() => this.auth.role() === 'headmaster' || this.auth.role() === 'teacher');
  classes = computed(() => this.data.schoolClasses());

  // ---- staff: section-wise fee collection ----
  classId = signal('8A');
  label = signal('Annual Fee');
  search = signal('');

  /** Students of the selected class, filtered by the name/id search. */
  rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.data
      .studentsOf(this.classId())
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.roll.toLowerCase().includes(q) || (s.admissionNo ?? '').toLowerCase().includes(q));
  });

  fee(s: Student): FeeItem | undefined {
    return this.data.feeFor(s, this.label());
  }
  amountOf(s: Student): number | null {
    return this.fee(s)?.amount ?? null;
  }
  isPaid(s: Student): boolean {
    return this.fee(s)?.status === 'paid';
  }

  setAmount(s: Student, value: string) {
    this.data.setStudentFee(s, this.label(), Number(value) || 0);
  }
  togglePaid(s: Student) {
    const f = this.fee(s);
    if (!f) return;
    this.data.setFeeStatus(f.id, f.status === 'paid' ? 'pending' : 'paid');
  }

  /** Live totals for the selected class & term. */
  private classFees = computed(() => {
    const label = this.label();
    return this.data
      .studentsOf(this.classId())
      .map((s) => this.data.feeFor(s, label))
      .filter((f): f is FeeItem => !!f);
  });
  totalFee = computed(() => this.classFees().reduce((sum, f) => sum + f.amount, 0));
  collected = computed(() => this.classFees().filter((f) => f.status === 'paid').reduce((sum, f) => sum + f.amount, 0));
  pending = computed(() => this.totalFee() - this.collected());

  // reminders (per student)
  private feeMsg(s: Student, amount: number, due: string): string {
    return this.notify.feeMessage(s.name, s.classId, amount, due);
  }
  waFee(s: Student): string {
    const f = this.fee(s)!;
    return this.notify.whatsappLink(s.parentPhone, this.feeMsg(s, f.amount, f.dueDate));
  }
  smsFee(s: Student): string {
    const f = this.fee(s)!;
    return this.notify.smsLink(s.parentPhone, this.feeMsg(s, f.amount, f.dueDate));
  }

  // ---- parent / student ----
  myStudent = computed(() => {
    const sid = this.auth.user()?.studentId;
    return sid ? this.data.student(sid) : undefined;
  });
  myFees = computed(() => {
    const sid = this.auth.user()?.studentId;
    return sid ? this.data.feesOf(sid) : [];
  });
  myPending = computed(() =>
    this.myFees().filter((f) => f.status === 'pending').reduce((s, f) => s + f.amount, 0),
  );
}
