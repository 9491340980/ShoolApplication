import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { FeeHead, FeeItem, PAYMENT_METHODS, Student } from '../../core/models';
import { buildExportName } from '../../core/export';
import { downloadElementPdf } from '../../core/report-pdf';
import { BulkSendService } from '../../core/bulk-send.service';
import { NotifyService } from '../../core/notify.service';
import { SchoolService } from '../../core/school.service';
import { ShareService } from '../../core/share.service';
import { TPipe, TranslateService } from '../../core/translate.service';

@Component({
  selector: 'app-fees',
  imports: [FormsModule, TPipe],
  templateUrl: './fees.component.html',
})
export class FeesComponent {
  auth = inject(AuthService);
  data = inject(DataService);
  bulk = inject(BulkSendService);
  notify = inject(NotifyService);
  i18n = inject(TranslateService);
  share = inject(ShareService);
  private schoolSvc = inject(SchoolService);

  isStaff = computed(() => this.auth.has('headmaster') || this.auth.has('teacher') || this.auth.has('accountant'));
  classes = computed(() => this.data.schoolClasses());
  schoolName = computed(() => this.schoolSvc.currentSchool()?.name ?? environment.schoolName);
  logo = computed(() => this.schoolSvc.currentSchool()?.logo || '');
  schoolAddress = computed(() => this.schoolSvc.currentSchool()?.address || '');
  schoolPhone = computed(() => this.schoolSvc.currentSchool()?.phone || '');

  // ---- fee receipt ----
  receiptStudent = signal<Student | null>(null);
  receiptDate = new Date().toISOString().slice(0, 10);

  openReceipt(s: Student) {
    this.receiptStudent.set(s);
  }
  closeReceipt() {
    this.receiptStudent.set(null);
  }
  downloading = signal(false);
  async printReceipt() {
    const el = document.getElementById('receipt-card');
    const s = this.receiptStudent();
    if (!el || !s) return;
    this.downloading.set(true);
    const name = buildExportName({ module: 'Receipt', target: s.name }, this.schoolName());
    try {
      await downloadElementPdf(el, `${name}.pdf`);
    } finally {
      this.downloading.set(false);
    }
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
  receiptWaLink(s: Student): string {
    const msg = this.notify.receiptMessage({
      name: s.name,
      classId: s.classId,
      receiptNo: this.receiptNo(s),
      date: this.receiptDate,
      items: this.receiptFees().map((f) => ({ label: f.label, amount: f.amount, status: f.status })),
      paid: this.receiptPaid(),
      balance: this.receiptBalance(),
    });
    return this.notify.whatsappLink(s.parentPhone, msg);
  }

  // ---- payment history (per student) ----
  historyStudent = signal<Student | null>(null);
  openHistory(s: Student) {
    this.historyStudent.set(s);
  }
  closeHistory() {
    this.historyStudent.set(null);
  }
  /** Fees of the student in the history popup, each with its dated installments. */
  historyFees = computed(() => {
    const s = this.historyStudent();
    if (!s) return [];
    return this.data.feesOf(s.id).map((f) => ({
      fee: f,
      payments: this.data.feePayments(f),
      paid: this.data.feePaid(f),
      balance: this.data.feeBalance(f),
    }));
  });
  historyTotal = computed(() => this.historyFees().reduce((a, x) => a + x.fee.amount, 0));
  historyPaid = computed(() => this.historyFees().reduce((a, x) => a + x.paid, 0));
  historyBalance = computed(() => this.historyFees().reduce((a, x) => a + x.balance, 0));

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
  /** Draft total being typed per student (kept separate so a cancelled reduce can revert cleanly). */
  private amountDraft = signal<Record<string, number | null>>({});
  amountVal(s: Student): number | null {
    const d = this.amountDraft();
    return s.id in d ? d[s.id] : this.amountOf(s);
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

  /** Track typing without saving yet. */
  onAmountInput(s: Student, value: string) {
    this.amountDraft.update((m) => ({ ...m, [s.id]: Number(value) || 0 }));
  }
  private clearDraft(s: Student) {
    this.amountDraft.update((m) => {
      const n = { ...m };
      delete n[s.id];
      return n;
    });
  }
  /** Commit on blur — confirm first if the new total is lower than the current one. */
  commitAmount(s: Student) {
    const d = this.amountDraft();
    if (!(s.id in d)) return;
    const amt = d[s.id] ?? 0;
    const f = this.fee(s);
    const oldAmt = f?.amount ?? 0;
    const paid = f ? this.data.feePaid(f) : 0;
    if (amt === oldAmt) {
      this.clearDraft(s);
      return;
    }
    if (f && amt < oldAmt) {
      const bal = Math.max(0, amt - paid);
      const te = this.i18n.lang() === 'te';
      const msg = te
        ? `${s.name} మొత్తం ఫీజును ₹${oldAmt} నుండి ₹${amt} కు తగ్గించాలా?\n\nఇప్పటికే వసూలు చేసిన ₹${paid} అలాగే ఉంటుంది. కొత్త బ్యాలెన్స్ ₹${bal} గా తిరిగి లెక్కించబడుతుంది.\n\nకొనసాగించాలా?`
        : `Reduce ${s.name}'s total fee from ₹${oldAmt} to ₹${amt}?\n\nThe ₹${paid} already collected will be kept. The new balance will be recalculated as ₹${bal}.\n\nContinue?`;
      if (!confirm(msg)) {
        this.clearDraft(s); // revert the input to the saved total
        return;
      }
    }
    this.data.setStudentFee(s, this.label(), amt);
    this.clearDraft(s);
  }

  /** Collect the entered installment against this student's fee. */
  collect(s: Student) {
    const f = this.fee(s);
    const amt = Number(this.collectInput()[s.id]) || 0;
    if (!f || amt <= 0) return;
    this.data.collectFee(f.id, amt, this.payMethod());
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

  // ---- tabs & payment method ----
  tab = signal<'collect' | 'structure' | 'report'>('collect');
  methods = PAYMENT_METHODS;
  payMethod = signal('Cash');
  flash = signal('');
  private toast(msg: string) {
    this.flash.set(msg);
    setTimeout(() => this.flash.set(''), 2500);
  }

  // ---- bulk dues reminders ----
  /** Students in the current class with a pending balance for the selected fee. */
  pendingRows = computed(() => this.rows().filter((s) => this.balanceOf(s) > 0));
  remindAllPending() {
    const items = this.pendingRows()
      .filter((s) => s.parentPhone)
      .map((s) => ({ name: s.name, link: this.notify.whatsappLink(s.parentPhone, this.feeMsg(s, this.balanceOf(s), this.fee(s)?.dueDate ?? '')) }));
    if (!items.length) {
      this.toast('No pending dues with a phone number.');
      return;
    }
    this.bulk.start(items);
  }

  // ---- concession / scholarship ----
  concStudent = signal<Student | null>(null);
  concAmount = signal<number | null>(null);
  concReason = signal('');
  openConcession(s: Student) {
    const f = this.fee(s);
    this.concStudent.set(s);
    this.concAmount.set(f?.concession ?? null);
    this.concReason.set(f?.concessionReason ?? '');
  }
  closeConcession() {
    this.concStudent.set(null);
  }
  concOf(s: Student): number {
    return this.fee(s)?.concession ?? 0;
  }
  saveConcession() {
    const s = this.concStudent();
    const f = s ? this.fee(s) : undefined;
    if (!s || !f) return;
    this.data.setConcession(f.id, Number(this.concAmount()) || 0, this.concReason());
    this.closeConcession();
    this.toast('Concession saved.');
  }

  // ---- fee structure template (per class) ----
  structHeads = signal<FeeHead[]>([]);
  private structLoader = effect(() => {
    const st = this.data.structureFor(this.classId());
    this.structHeads.set(st ? st.heads.map((h) => ({ ...h })) : [{ label: '', amount: 0, dueDate: '' }]);
  });
  addHead() {
    this.structHeads.update((h) => [...h, { label: '', amount: 0, dueDate: '' }]);
  }
  removeHead(i: number) {
    this.structHeads.update((h) => h.filter((_, idx) => idx !== i));
  }
  setHead(i: number, field: 'label' | 'amount' | 'dueDate', value: string) {
    this.structHeads.update((h) => h.map((x, idx) => (idx === i ? { ...x, [field]: field === 'amount' ? Number(value) || 0 : value } : x)));
  }
  saveStructure() {
    this.data.saveStructure(this.classId(), this.structHeads());
    this.toast('Structure saved.');
  }
  applyStructure() {
    this.data.saveStructure(this.classId(), this.structHeads());
    const n = this.data.applyStructure(this.classId());
    this.toast(`Applied to ${n} fee record(s).`);
  }

  // ---- daily collection report ----
  reportDate = signal(new Date().toISOString().slice(0, 10));
  private studentName(id: string): string {
    return this.data.student(id)?.name ?? '—';
  }
  dayCollections = computed(() =>
    this.data
      .feeCollections()
      .filter((c) => c.date === this.reportDate())
      .map((c) => ({ ...c, name: this.studentName(c.studentId) }))
      .sort((a, b) => b.amount - a.amount),
  );
  dayTotal = computed(() => this.dayCollections().reduce((s, c) => s + c.amount, 0));
  dayByMethod = computed(() => {
    const map = new Map<string, number>();
    for (const c of this.dayCollections()) map.set(c.method, (map.get(c.method) ?? 0) + c.amount);
    return [...map.entries()].map(([method, total]) => ({ method, total })).sort((a, b) => b.total - a.total);
  });

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
