import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { DataService } from '../../core/data.service';
import { SchoolService } from '../../core/school.service';
import { PAYMENT_METHODS, SalaryComponent, StaffSalary } from '../../core/models';
import { buildExportName } from '../../core/export';
import { downloadElementPdf } from '../../core/report-pdf';
import { TPipe } from '../../core/translate.service';

const ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function words3(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + words3(n % 100) : '');
}
function rupeesInWords(n: number): string {
  if (n <= 0) return 'Zero';
  const parts: string[] = [];
  const cr = Math.floor(n / 10000000);
  n %= 10000000;
  const lk = Math.floor(n / 100000);
  n %= 100000;
  const th = Math.floor(n / 1000);
  n %= 1000;
  if (cr) parts.push(words3(cr) + ' Crore');
  if (lk) parts.push(words3(lk) + ' Lakh');
  if (th) parts.push(words3(th) + ' Thousand');
  if (n) parts.push(words3(n));
  return parts.join(' ') + ' Rupees Only';
}

@Component({
  selector: 'app-payroll',
  imports: [FormsModule, TPipe],
  templateUrl: './payroll.component.html',
})
export class PayrollComponent {
  data = inject(DataService);
  private schoolSvc = inject(SchoolService);

  methods = PAYMENT_METHODS;
  schoolName = computed(() => this.schoolSvc.currentSchool()?.name ?? environment.schoolName);
  schoolAddress = computed(() => this.schoolSvc.currentSchool()?.address || '');
  logo = computed(() => this.schoolSvc.currentSchool()?.logo || '');

  month = signal(new Date().toISOString().slice(0, 7));
  payMethod = signal('Bank');
  staff = computed(() => this.data.salaries());

  net(s: StaffSalary): number {
    return this.data.netSalary(s);
  }
  isPaid(s: StaffSalary): boolean {
    return !!this.data.staffPaidFor(s, this.month());
  }
  total = computed(() => this.staff().reduce((a, s) => a + this.net(s), 0));
  paidTotal = computed(() => this.staff().filter((s) => this.isPaid(s)).reduce((a, s) => a + this.net(s), 0));
  paidCount = computed(() => this.staff().filter((s) => this.isPaid(s)).length);

  fmtMonth(m: string): string {
    return new Date(m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  flash = signal('');
  private toast(m: string) {
    this.flash.set(m);
    setTimeout(() => this.flash.set(''), 2500);
  }

  // ---- add / edit staff ----
  editingId = signal<string | null>(null);
  fName = signal('');
  fRole = signal('');
  fBase = signal<number | null>(null);
  fAllow = signal<SalaryComponent[]>([]);
  fDeduct = signal<SalaryComponent[]>([]);
  showBreakup = signal(false);

  fNet = computed(() => {
    const add = this.fAllow().reduce((a, c) => a + (Number(c.amount) || 0), 0);
    const cut = this.fDeduct().reduce((a, c) => a + (Number(c.amount) || 0), 0);
    return Math.max(0, Math.round((Number(this.fBase()) || 0) + add - cut));
  });
  addAllow() {
    this.fAllow.update((l) => [...l, { label: '', amount: 0 }]);
    this.showBreakup.set(true);
  }
  addDeduct() {
    this.fDeduct.update((l) => [...l, { label: '', amount: 0 }]);
    this.showBreakup.set(true);
  }
  setComp(which: 'a' | 'd', i: number, field: 'label' | 'amount', value: string) {
    const sig = which === 'a' ? this.fAllow : this.fDeduct;
    sig.update((l) => l.map((c, idx) => (idx === i ? { ...c, [field]: field === 'amount' ? Number(value) || 0 : value } : c)));
  }
  removeComp(which: 'a' | 'd', i: number) {
    const sig = which === 'a' ? this.fAllow : this.fDeduct;
    sig.update((l) => l.filter((_, idx) => idx !== i));
  }

  private reset() {
    this.editingId.set(null);
    this.fName.set('');
    this.fRole.set('');
    this.fBase.set(null);
    this.fAllow.set([]);
    this.fDeduct.set([]);
    this.showBreakup.set(false);
  }
  cancel() {
    this.reset();
  }
  edit(s: StaffSalary) {
    this.editingId.set(s.id);
    this.fName.set(s.name);
    this.fRole.set(s.role ?? '');
    this.fBase.set(s.monthlySalary);
    this.fAllow.set((s.allowances ?? []).map((c) => ({ ...c })));
    this.fDeduct.set((s.deductions ?? []).map((c) => ({ ...c })));
    this.showBreakup.set((s.allowances?.length ?? 0) + (s.deductions?.length ?? 0) > 0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  save() {
    if (!this.fName().trim() || !this.fBase()) return;
    this.data.setSalary({ id: this.editingId() ?? undefined, name: this.fName(), role: this.fRole(), monthlySalary: Number(this.fBase()), allowances: this.fAllow(), deductions: this.fDeduct() });
    this.reset();
  }
  remove(s: StaffSalary) {
    if (confirm(`Remove ${s.name} from payroll? (Past payments stay in the cash book.)`)) this.data.removeSalary(s.id);
  }

  // ---- pay / reverse ----
  pay(s: StaffSalary) {
    const m = this.fmtMonth(this.month());
    if (!confirm(`Record ₹${this.net(s).toLocaleString('en-IN')} salary for ${s.name} (${m}) as a Salaries expense?`)) return;
    if (this.data.payStaff(s.id, this.month(), this.payMethod())) this.toast(`Paid ${s.name} for ${m}.`);
  }
  payAll() {
    const unpaid = this.staff().filter((s) => !this.isPaid(s));
    if (!unpaid.length) {
      this.toast('Everyone is already paid for this month.');
      return;
    }
    const sum = unpaid.reduce((a, s) => a + this.net(s), 0);
    if (!confirm(`Pay ${unpaid.length} staff for ${this.fmtMonth(this.month())} — ₹${sum.toLocaleString('en-IN')} total — and post to the cash book?`)) return;
    const n = this.data.payAllStaff(this.month(), this.payMethod());
    this.toast(`Posted ${n} salary payment(s) to the cash book.`);
  }
  reverse(s: StaffSalary) {
    if (confirm(`Undo ${s.name}'s payment for ${this.fmtMonth(this.month())}? This removes the matching cash-book expense.`)) {
      if (this.data.reversePay(s.id, this.month())) this.toast('Payment reversed.');
    }
  }

  // ---- salary slip ----
  slipStaff = signal<StaffSalary | null>(null);
  openSlip(s: StaffSalary) {
    this.slipStaff.set(s);
  }
  closeSlip() {
    this.slipStaff.set(null);
  }
  slipPayout() {
    const s = this.slipStaff();
    return s ? this.data.staffPaidFor(s, this.month()) : undefined;
  }
  netWords(n: number): string {
    return rupeesInWords(n);
  }
  history(s: StaffSalary) {
    return [...(s.payouts ?? [])].sort((a, b) => b.month.localeCompare(a.month));
  }

  downloading = signal(false);
  async downloadSlip() {
    const el = document.getElementById('slip-print');
    const s = this.slipStaff();
    if (!el || !s) return;
    this.downloading.set(true);
    const name = buildExportName({ module: 'Payslip', category: this.month(), target: s.name }, this.schoolName());
    try {
      await downloadElementPdf(el, `${name}.pdf`);
    } finally {
      this.downloading.set(false);
    }
  }
}
