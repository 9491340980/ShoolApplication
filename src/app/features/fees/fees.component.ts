import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { FeeItem, Student } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { SchoolService } from '../../core/school.service';
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
  private schoolSvc = inject(SchoolService);

  isStaff = computed(() => this.auth.role() === 'headmaster' || this.auth.role() === 'teacher');
  classes = computed(() => this.data.schoolClasses());
  schoolName = computed(() => this.schoolSvc.currentSchool()?.name ?? environment.schoolName);

  // ---- fee receipt ----
  receiptStudent = signal<Student | null>(null);
  receiptDate = new Date().toISOString().slice(0, 10);

  openReceipt(s: Student) {
    this.receiptStudent.set(s);
  }
  closeReceipt() {
    this.receiptStudent.set(null);
  }
  printReceipt() {
    window.print();
  }
  receiptFees = computed(() => {
    const s = this.receiptStudent();
    return s ? this.data.feesOf(s.id) : [];
  });
  receiptPaid = computed(() => this.receiptFees().reduce((a, f) => a + this.data.feePaid(f), 0));
  receiptBalance = computed(() => this.receiptFees().reduce((a, f) => a + this.data.feeBalance(f), 0));
  receiptNo(s: Student): string {
    return `R-${s.roll}-${this.receiptDate.replace(/-/g, '')}`;
  }
  sendReceiptWa(s: Student) {
    const msg = this.notify.receiptMessage({
      name: s.name,
      classId: s.classId,
      receiptNo: this.receiptNo(s),
      date: this.receiptDate,
      items: this.receiptFees().map((f) => ({ label: f.label, amount: f.amount, status: f.status })),
      paid: this.receiptPaid(),
      balance: this.receiptBalance(),
    });
    window.open(this.notify.whatsappLink(s.parentPhone, msg), '_blank');
  }

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

  /** Per-student installment amount being entered. */
  collectInput = signal<Record<string, number | null>>({});

  fee(s: Student): FeeItem | undefined {
    return this.data.feeFor(s, this.label());
  }
  amountOf(s: Student): number | null {
    return this.fee(s)?.amount ?? null;
  }
  paidOf(s: Student): number {
    const f = this.fee(s);
    return f ? this.data.feePaid(f) : 0;
  }
  balanceOf(s: Student): number {
    const f = this.fee(s);
    return f ? this.data.feeBalance(f) : 0;
  }
  isPaid(s: Student): boolean {
    const f = this.fee(s);
    return !!f && this.data.feeBalance(f) === 0 && f.amount > 0;
  }

  setAmount(s: Student, value: string) {
    this.data.setStudentFee(s, this.label(), Number(value) || 0);
  }

  /** Collect the entered installment against this student's fee. */
  collect(s: Student) {
    const f = this.fee(s);
    const amt = Number(this.collectInput()[s.id]) || 0;
    if (!f || amt <= 0) return;
    this.data.collectFee(f.id, amt);
    this.collectInput.update((m) => ({ ...m, [s.id]: null }));
  }
  setCollect(s: Student, value: string) {
    this.collectInput.update((m) => ({ ...m, [s.id]: Number(value) || null }));
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
  collected = computed(() => this.classFees().reduce((sum, f) => sum + this.data.feePaid(f), 0));
  pending = computed(() => this.classFees().reduce((sum, f) => sum + this.data.feeBalance(f), 0));

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
